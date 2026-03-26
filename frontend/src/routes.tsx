// // src/routes.tsx
// import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
// import { LandingPage } from "./pages/LandingPage";
// import { useState } from "react";

// export function AppRoutes() {
//   const [showLogin, setShowLogin] = useState(false);
//   return (
//     <Router>
//       <Routes>
//         <Route
//           path="/"
//           element={<LandingPage onShowLogin={() => setShowLogin(true)} />}
//         />
//         <Route path="/about" element={<AboutUsPage />} />
//         <Route path="/contact" element={<ContactUsPage />} />
//         <Route path="/terms" element={<TermsAndConditionsPage />} />
//       </Routes>
//     </Router>
//   );
// }
