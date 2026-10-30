package plugin

import (
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type schemaInferenceState struct {
	typeGuesses map[string]data.FieldType
	currentRow  map[string]data.FieldType
	ignored     map[string]struct{}
	afterFirst  bool
}

func NewSchemaInference(ignored map[string]struct{}) schemaInferenceState {
	return schemaInferenceState{
		typeGuesses: make(map[string]data.FieldType),
		currentRow:  make(map[string]data.FieldType),
		ignored:     ignored,
		afterFirst:  false,
	}
}

func (s *schemaInferenceState) updateField(name string, value interface{}) error {
	if _, ignored := s.ignored[name]; ignored {
		return nil
	}
	_, guess, err := ToGrafanaValue(value)
	if err != nil {
		return err
	}
	// if err is nil and type is still unknown, original value must be null or undefined,
	// which we treat the same as being absent
	if guess == data.FieldTypeUnknown {
		return nil
	}
	s.currentRow[name] = guess
	return nil
}

func (s *schemaInferenceState) updateDoc(doc timestepDocument) error {
	for name, value := range doc {
		err := s.updateField(name, value)
		if err != nil {
			return err
		}
	}
	return s.nextDoc()
}

// UpdateDoc updates the schema inference state with a new document.
func (s *schemaInferenceState) UpdateDoc(doc timestepDocument) error {
	return s.updateDoc(doc)
}

func (s *schemaInferenceState) nextDoc() error {
	mismatchOld := make(map[string]data.FieldType, len(s.typeGuesses))
	mismatchNew := make(map[string]data.FieldType, len(s.typeGuesses))
	if s.afterFirst {
		for name, guess := range s.typeGuesses {
			// Any non-nullable guesses that aren't in the current row must be nullable
			_, stillHere := s.currentRow[name]
			if !stillHere && !guess.Nullable() {
				log.DefaultLogger.Debug("New field discovered after first row, making type nullable", "name", name)
				s.typeGuesses[name] = guess.NullableType()
			}
		}
	}
	for name, currentType := range s.currentRow {
		guess, known := s.typeGuesses[name]
		if !s.afterFirst {
			// If this is the first document, guesses /are/ the current row
			s.typeGuesses[name] = currentType
		} else if s.afterFirst && !known && !currentType.Nullable() {
			// If a new field is found after the first document,
			// the old guess must be made nullable
			log.DefaultLogger.Debug("Field missing after first row, making type nullable", "name", name)
			s.typeGuesses[name] = currentType.NullableType()
		} else if s.afterFirst && known && (currentType == guess || currentType.NullableType() == guess) {
			// If the new guess and the old guess are the same modulo nullability,
			// then no action is necessary
		} else {
			// Otherwise, record a mismatch
			// We don't exit immediately so that the user can know about and fix all mismatches at once
			mismatchOld[name] = guess
			mismatchNew[name] = currentType
		}
	}

	if len(mismatchOld) != 0 {
		mismatchedNames := make([]string, 0, len(mismatchOld))
		for name := range mismatchOld {
			mismatchedNames = append(mismatchedNames, name)
		}
		sort.Strings(mismatchedNames)

		errMsg := strings.Builder{}
		errMsg.WriteString("Field(s) appeared with different types. Please ensure value fields are the same type in each document: ")
		for i, name := range mismatchedNames {
			old := mismatchOld[name]
			newType := mismatchNew[name]
			if i > 0 {
				errMsg.WriteString(", ")
			}
			errMsg.WriteString(fmt.Sprintf("%s (%s vs %s)", name, old, newType))
		}
		return errors.New(errMsg.String())
	}

	s.afterFirst = true
	s.currentRow = make(map[string]data.FieldType, len(s.typeGuesses))
	return nil
}

func (s *schemaInferenceState) finish() []field {
	names := make([]string, 0, len(s.typeGuesses))
	for name := range s.typeGuesses {
		names = append(names, name)
	}
	sort.Strings(names)

	fields := make([]field, 0, len(names))
	for _, name := range names {
		fields = append(fields, field{Name: name, Type: s.typeGuesses[name]})
	}
	return fields
}

// Finish returns the deterministically ordered list of inferred fields.
func (s *schemaInferenceState) Finish() []field {
	return s.finish()
}
