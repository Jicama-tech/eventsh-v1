// hooks/useAuth.tsx

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { jwtDecode } from "jwt-decode";
import { useNavigate } from "react-router-dom";

export interface User {
  sub: string;
  email: string;
  name: string;
  roles: string[]; // Ensure this matches your backend JWT payload
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Check if a JWT token is expired
  const isTokenExpired = (token: string): boolean => {
    try {
      const decoded: any = jwtDecode(token);
      const currentTime = Date.now() / 1000;
      return decoded.exp < currentTime;
    } catch {
      return true;
    }
  };

  // Initialize auth on app startup
  useEffect(() => {
    const initializeAuth = () => {
      setLoading(true);
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const tokenFromUrl = urlParams.get("token");

        const handleToken = (token: string) => {
          if (isTokenExpired(token)) {
            sessionStorage.removeItem("token");
            setUser(null);
            return;
          }
          sessionStorage.setItem("token", token);
          const decodedUser = jwtDecode<User>(token);
          setUser(decodedUser);
          // Clean URL of token param
          if (tokenFromUrl) {
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname
            );
          }
        };

        if (tokenFromUrl) {
          handleToken(tokenFromUrl);
        } else {
          const storedToken = sessionStorage.getItem("token");
          if (storedToken) {
            handleToken(storedToken);
          }
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Login sets token and user
  const login = (token: string) => {
    if (isTokenExpired(token)) {
      console.error("Cannot login with expired token");
      return;
    }
    sessionStorage.setItem("token", token);
    const decodedUser = jwtDecode<User>(token);
    setUser(decodedUser);
  };

  // Logout clears token and user, navigates home
  const logout = () => {
    sessionStorage.removeItem("token");
    setUser(null);
    navigate("/");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
