import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";

import { NavSectionProps } from "../types";
import { sectionLinks } from "./data";

export function Nav({ isOpen, setIsOpen, onShowLogin }: NavSectionProps) {
  return (
    <nav className="eh-nav">
      <div className="eh-nav-in">
        <Link to="/" className="eh-brand" aria-label="Eventsh home">
          <img src="/EventshLogo.png" alt="Eventsh" />
        </Link>

        <div className="eh-nav-links">
          {sectionLinks.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
          <Link to="/contact">Contact</Link>
        </div>

        <div className="eh-nav-cta">
          <button
            type="button"
            className="eh-btn eh-btn-p eh-btn-sm"
            onClick={onShowLogin}
          >
            Start free
          </button>
          <button
            type="button"
            className="eh-burger"
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
            className="eh-mobile"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <div className="eh-wrap">
              {sectionLinks.map((l) => (
                <a key={l.href} href={l.href} onClick={() => setIsOpen(false)}>
                  {l.label}
                </a>
              ))}
              <Link to="/contact" onClick={() => setIsOpen(false)}>
                Contact
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
