import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

const TicketVerifyPage = () => {
  const query = useQuery();
  const apiURL = __API_URL__;
  const ticketId = query.get("ticketId");
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (ticketId) {
      fetch(`${apiURL}/tickets/${ticketId}`)
        .then((res) => {
          if (!res.ok) throw new Error("Ticket not found");
          return res.json();
        })
        .then((data) => {
          setTicket(data);
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        });
    } else {
      setError("No ticketId provided");
      setLoading(false);
    }
  }, [ticketId]);

  if (loading) return <div>Loading ticket details...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!ticket) return <div>No ticket data</div>;

  return (
    <div>
      <h1>{ticket.eventTitle}</h1>
      <p>Name: {ticket.customerName}</p>
      <p>Date: {ticket.date}</p>
      <p>Venue: {ticket.venue}</p>
      {/* More details here */}
    </div>
  );
};

export default TicketVerifyPage;
