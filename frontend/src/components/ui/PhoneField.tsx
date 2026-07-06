import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";

/**
 * Shared phone input with a country-code dropdown (flag + dial code + search).
 * Wraps react-phone-input-2 with the app's standard styling so every contact
 * number field looks and behaves the same. `value` is the full number incl.
 * country code (digits, no "+"); `onChange` returns that string.
 */
export function PhoneField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <PhoneInput
      value={value}
      onChange={(v) => onChange(v)}
      country="in"
      enableSearch
      countryCodeEditable={false}
      preferredCountries={["in", "sg", "us", "gb", "ae", "au"]}
      placeholder={placeholder}
      inputStyle={{
        width: "100%",
        height: "40px",
        fontSize: "14px",
        paddingLeft: "48px",
        borderRadius: "8px",
        border: "1px solid #e2e8f0",
        color: "#1f2937",
        backgroundColor: "#ffffff",
        fontWeight: 500,
      }}
      containerStyle={{ width: "100%" }}
      buttonStyle={{
        borderRadius: "8px 0 0 8px",
        border: "1px solid #e2e8f0",
        borderRight: "none",
        background: "#ffffff",
      }}
      dropdownStyle={{ width: "260px", color: "#1f2937" }}
    />
  );
}
