import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { toE164, toPhoneInputValue } from "@/lib/phone";

/**
 * Shared phone input with a country-code dropdown (flag + dial code + search).
 * Wraps react-phone-input-2 with the app's standard styling so every contact
 * and WhatsApp number field looks and behaves the same.
 *
 * `value` may be anything the record holds ("+919876543210", "919876543210",
 * "+91 98765 43210"); the widget shows it against the right flag. `onChange`
 * emits the full number including the dial code:
 *   - format "e164" (the app standard, see lib/phone.ts): "+919876543210"
 *   - format "digits" (the widget's raw form, older callers): "919876543210"
 */
export function PhoneField({
  value,
  onChange,
  placeholder,
  format = "digits",
  defaultCountry = "in",
  id,
  name,
  disabled = false,
  required = false,
  compact = false,
  className,
  autoFocus = false,
  onBlur,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  format?: "e164" | "digits";
  /** ISO-2, lower case ("in", "sg"). Used until the value carries a code. */
  defaultCountry?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  /** 36px tall, for dense dialog forms. */
  compact?: boolean;
  className?: string;
  autoFocus?: boolean;
  onBlur?: () => void;
}) {
  const height = compact ? "36px" : "40px";
  const radius = compact ? "6px" : "8px";
  return (
    <PhoneInput
      value={toPhoneInputValue(value)}
      onChange={(v) => onChange(format === "e164" ? toE164(v) : v)}
      country={defaultCountry}
      enableSearch
      countryCodeEditable={false}
      preferredCountries={["in", "sg", "us", "gb", "ae", "au"]}
      placeholder={placeholder}
      disabled={disabled}
      containerClass={className}
      inputProps={{
        id,
        name,
        required,
        autoFocus,
        autoComplete: "tel",
        inputMode: "tel",
        onBlur,
      }}
      inputStyle={{
        width: "100%",
        height,
        fontSize: "14px",
        paddingLeft: "48px",
        borderRadius: radius,
        border: "1px solid hsl(var(--input, var(--border)))",
        color: "hsl(var(--foreground))",
        backgroundColor: "hsl(var(--background))",
        fontWeight: 500,
        opacity: disabled ? 0.6 : 1,
      }}
      containerStyle={{ width: "100%" }}
      buttonStyle={{
        borderRadius: `${radius} 0 0 ${radius}`,
        border: "1px solid hsl(var(--input, var(--border)))",
        borderRight: "none",
        background: "hsl(var(--background))",
      }}
      dropdownStyle={{
        width: "260px",
        color: "hsl(var(--popover-foreground, var(--foreground)))",
        background: "hsl(var(--popover, var(--background)))",
      }}
      searchStyle={{ width: "90%" }}
    />
  );
}

export default PhoneField;
