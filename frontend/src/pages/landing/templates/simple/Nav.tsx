import { Link } from "react-router-dom";

import { NavSectionProps } from "../types";

/**
 * The whole nav: brand, login, get started. No section links — the page has
 * no sections to jump to. Features and pricing live in the footer, one click
 * away for the buyer who wants depth.
 */
export function Nav({ onShowLogin }: NavSectionProps) {
  return (
    <nav className="sp-nav">
      <div className="wrap in">
        <Link to="/" className="sp-logo">
          <i aria-hidden="true" />
          Eventsh
        </Link>
        <div className="right">
          <button type="button" className="sp-btn sp-btn-g" onClick={onShowLogin}>
            Login
          </button>
          <button type="button" className="sp-btn sp-btn-p" onClick={onShowLogin}>
            Get Started
          </button>
        </div>
      </div>
    </nav>
  );
}
