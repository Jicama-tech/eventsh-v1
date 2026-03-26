import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface CountryContextType {
  country: string;
  setCountry: (country: string) => void;
}

const CountryContext = createContext<CountryContextType>({
  country: "IN",
  setCountry: () => {},
});

export function CountryProvider({ children }: { children: ReactNode }) {
  const [country, setCountryState] = useState(
    () => sessionStorage.getItem("Country") || "IN"
  );

  const setCountry = useCallback((newCountry: string) => {
    setCountryState(newCountry);
    sessionStorage.setItem("Country", newCountry);
  }, []);

  return (
    <CountryContext.Provider value={{ country, setCountry }}>
      {children}
    </CountryContext.Provider>
  );
}

export const useCountry = () => useContext(CountryContext);
