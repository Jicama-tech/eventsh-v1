import { useState } from "react";
import { Link } from "react-router-dom";

import { AppFeedbackModal } from "@/components/landing/AppFeedbackModal";

import { BRAND, SITE } from "./data";

// Contact details carried over verbatim from the shared site footer
// (components/ui/footer.tsx) — this template needs its own dark footer to
// avoid the shared one's light gradient, but not its own facts.
const WHATSAPP = "https://wa.me/6590037950";
const MAPS = "https://maps.app.goo.gl/aBrUkFKLBpsg4Csu8";

export function Footer() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const year = new Date().getFullYear();

  return (
    <footer className="eh-foot">
      <div className="eh-wrap eh-foot-in">
        <div>
          <Link to="/" className="eh-brand" aria-label="Eventsh home">
            <img src="/EventshLogo.png" alt="Eventsh" />
          </Link>
          <p className="eh-foot-blurb">
            The event platform that runs the floor, the guests, the money and
            the suppliers — on one link.
          </p>
          <div className="eh-socials">
            <a
              href={WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
            >
              <svg viewBox="0 0 24 24">
                <path d="M21 12a9 9 0 01-13.3 7.9L3 21l1.2-4.5A9 9 0 1121 12z" />
                <path d="M8.8 9.2c.3 2.4 3.6 5.7 6 6l1-1.4 2 1-.6 1.6c-2.9.5-7.9-4.5-7.4-7.4l1.6-.6z" />
              </svg>
            </a>
            <a href="mailto:hello@eventsh.com" aria-label="Email us">
              <svg viewBox="0 0 24 24">
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
              <svg viewBox="0 0 24 24">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1116 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </a>
          </div>
        </div>

        <div>
          <h5>Platform</h5>
          <ul>
            <li>
              <a href="#platform">Floor plan designer</a>
            </li>
            <li>
              <a href="#platform">Registration</a>
            </li>
            <li>
              <a href="#money">Payments</a>
            </li>
            <li>
              <a href="#platform">Suppliers</a>
            </li>
            <li>
              <a href="#money">Ledger &amp; invoicing</a>
            </li>
          </ul>
        </div>

        <div>
          <h5>Events</h5>
          <ul>
            <li>
              <a href="#worlds">Expos &amp; trade shows</a>
            </li>
            <li>
              <a href="#worlds">Conferences</a>
            </li>
            <li>
              <a href="#worlds">Weddings</a>
            </li>
            <li>
              <a href="#worlds">Award nights</a>
            </li>
            <li>
              <a href="#worlds">Workshops</a>
            </li>
          </ul>
        </div>

        <div>
          <h5>Company</h5>
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

      <div className="eh-wrap eh-foot-base">
        <span>
          © {year} {BRAND} · Powered by{" "}
          <a href="https://jicama.tech">Jicama.tech</a>
        </span>
        <span>
          <a href="/privacy-policy">Privacy</a> · <a href="/terms">Terms</a> ·{" "}
          {SITE}
        </span>
      </div>

      <AppFeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </footer>
  );
}
