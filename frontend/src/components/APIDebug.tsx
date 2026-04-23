import { useEffect } from "react";

export function APIDebugComponent() {
  useEffect(() => {
    const testLogin = async () => {
      try {
        console.log("Testing API connection...");
        console.log("API Base URL:", import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api");
        
        const response = await fetch("http://127.0.0.1:8000/api/auth/token/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: "admin@nobonir.com",
            password: "admin@1234",
          }),
        });
        
        console.log("Status:", response.status);
        const data = await response.json();
        console.log("Response:", data);
      } catch (error) {
        console.error("Error:", error);
      }
    };
    
    // Only run once on component mount
    testLogin();
  }, []);
  
  return <div>Check console for API test results</div>;
}
