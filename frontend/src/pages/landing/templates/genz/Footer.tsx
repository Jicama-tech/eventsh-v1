import { useState } from "react";
import { Link } from "react-router-dom";

import { AppFeedbackModal } from "@/components/landing/AppFeedbackModal";

// Contact details carried over verbatim from the shared site footer
// (components/ui/footer.tsx) — this template needs its own dark footer to
// avoid the shared one's light gradient, but not its own facts.
const WHATSAPP = "https://wa.me/6590037950";
const MAPS = "https://maps.app.goo.gl/aBrUkFKLBpsg4Csu8";

export function Footer() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <footer className="gzfooter">
      <div className="wrap">
        <div className="fgrid">
          <div className="fabout">
            <img src="/EventshLogo.png" alt="Eventsh" />
            <p>
              Expos, weddings and everything in between — one dashboard, one
              link, one login.
            </p>
            <div className="socials">
              <a
                href={WHATSAPP}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 12a9 9 0 01-13.3 7.9L3 21l1.2-4.5A9 9 0 1121 12z" />
                  <path d="M8.8 9.2c.3 2.4 3.6 5.7 6 6l1-1.4 2 1-.6 1.6c-2.9.5-7.9-4.5-7.4-7.4l1.6-.6z" />
                </svg>
              </a>
              <a href="mailto:hello@eventsh.com" aria-label="Email us">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M3 7l9 6 9-6" />
                </svg>
              </a>
              <a
                href={MAPS}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Find us"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1116 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </a>
            </div>
          </div>

          <div>
            <h4>Product</h4>
            <ul>
              <li>
                <a href="#modules">Ticketing</a>
              </li>
              <li>
                <a href="#modules">Stalls & floor plan</a>
              </li>
              <li>
                <a href="#modules">QR check-in</a>
              </li>
              <li>
                <a href="#modules">Weddings & RSVPs</a>
              </li>
              <li>
                <a href="#modules">Live analytics</a>
              </li>
            </ul>
          </div>

          <div>
            <h4>Company</h4>
            <ul>
              <li>
                <Link to="/about">About</Link>
              </li>
              <li>
                <Link to="/contact">Contact</Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setFeedbackOpen(true)}
                  style={{
                    background: "none",
                    border: 0,
                    padding: 0,
                    color: "inherit",
                    font: "inherit",
                    cursor: "pointer",
                  }}
                >
                  Share feedback
                </button>
              </li>
              <li>
                <a href="/admin-login">Admin</a>
              </li>
              <li>
                <a href="/agent-login">Agent login</a>
              </li>
            </ul>
          </div>

          <div>
            <h4>Contact</h4>
            <ul>
              <li>
                <a href="https://eventsh.com">eventsh.com</a>
              </li>
              <li>
                <a href="mailto:hello@eventsh.com">hello@eventsh.com</a>
              </li>
              <li>
                <a href={WHATSAPP} target="_blank" rel="noopener noreferrer">
                  +65 9003 7950
                </a>
              </li>
              <li>
                <a href={MAPS} target="_blank" rel="noopener noreferrer">
                  3 Central Boulevard, Singapore 018965
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="fbot">
          <span>
            © {new Date().getFullYear()} Eventsh. Powered by{" "}
            <a href="https://jicama.tech">Jicama.tech</a>
          </span>
          <span>
            <a href="/privacy-policy">Privacy</a> &nbsp;·&nbsp;{" "}
            <a href="/terms">Terms</a>
          </span>
        </div>
      </div>

      <AppFeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </footer>
  );
}
