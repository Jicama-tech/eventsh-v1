import { Link } from "react-router-dom";

/** One thin row. Everything the homepage dropped is reachable from here. */
export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="sp-foot">
      <div className="wrap in">
        <span>© {year} Eventsh</span>
        <Link to="/about">About</Link>
        <Link to="/contact">Contact</Link>
        <Link to="/terms">Terms</Link>
        <a className="right" href="mailto:hello@eventsh.com">
          hello@eventsh.com
        </a>
      </div>
    </footer>
  );
}
