package plugin_test

import (
	"time"

	"github.com/meln5674/grafana-mongodb-community-plugin/pkg/plugin"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

var _ = Describe("ConvertGoTimeFormatToMongo", func() {
	It("Should convert a truncated ruby date", func() {
		converted, err := plugin.ConvertGoTimeFormatToMongo(time.RubyDate[4:])
		Expect(err).ToNot(HaveOccurred())
		Expect(converted).To(Equal("%b %d %H:%M:%S %z %Y"))
	})

	It("Should convert standard ISO-like date and time specifiers", func() {
		converted, err := plugin.ConvertGoTimeFormatToMongo("2006-01-02 15:04:05 -0700")
		Expect(err).ToNot(HaveOccurred())
		Expect(converted).To(Equal("%Y-%m-%d %H:%M:%S %z"))
	})

	It("Should escape literal percent signs and convert day-of-year and month names", func() {
		converted, err := plugin.ConvertGoTimeFormatToMongo("% January __2 002 -07")
		Expect(err).ToNot(HaveOccurred())
		Expect(converted).To(Equal("%% %B %j %j %z"))
	})

	It("Should return an error when a single unsupported specifier is present", func() {
		_, err := plugin.ConvertGoTimeFormatToMongo("Mon Jan 02 15:04:05 2006")
		Expect(err).To(HaveOccurred())
		Expect(err.Error()).To(Equal("MongoDB does not have an equivalent for the following date specifiers: Mon"))
	})

	It("Should return a properly comma-separated error when multiple unsupported specifiers are present", func() {
		_, err := plugin.ConvertGoTimeFormatToMongo("Monday 03:04:05 PM 06")
		Expect(err).To(HaveOccurred())
		Expect(err.Error()).To(Equal("MongoDB does not have an equivalent for the following date specifiers: Monday, 03, PM, 06"))
	})
})
