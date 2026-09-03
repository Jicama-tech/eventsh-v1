import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";

import { NavSectionProps } from "../types";
import { sectionLinks } from "./data";

export function Nav({ isOpen, setIsOpen, onShowLogin }: NavSectionProps) {
  return (
    <nav className="nav">
      <div className="wrap">
        <Link to="/" className="navlogo" aria-label="Eventsh home">
          <img src="/EventshLogo.png" alt="Eventsh" />
        </Link>

        <div className="navlinks">
          {sectionLinks.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
          <Link to="/contact">Contact</Link>
        </div>

        <div className="navright">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onShowLogin}
          >
            Start free
          </button>
          <button
            type="button"
            className="burger"
            aria-label={isOpen ? "Close menu" : "Open menu"}
            aria-expanded={isOpen}
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="mobilemenu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <div className="wrap">
              {sectionLinks.map((l) => (
                <a key={l.href} href={l.href} onClick={() => setIsOpen(false)}>
                  {l.label}
                </a>
              ))}
              <Link to="/contact" onClick={() => setIsOpen(false)}>
                Contact
              </Link>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setIsOpen(false);
                  onShowLogin();
                }}
              >
                Start free
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
