import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function OAuthSuccess() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (token) {
      sessionStorage.setItem("token", token);
      navigate("/dashboard"); // Redirect to your dashboard or home
    } else {
      console.error("[OAuthSuccess] No token found in URL");
    }
  }, [navigate]);

  return <p>Logging you in...</p>;
}
