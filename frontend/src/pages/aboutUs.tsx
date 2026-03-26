import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, CalendarDays, Store, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export function AboutUsPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/50 to-background">
      <div className="container mx-auto px-4 py-16">
        <div className="absolute top-4 left-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)} // This navigates back to the previous page
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
        </div>
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">About EventFlow</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Our mission is to create a seamless and vibrant ecosystem for event
            organizers, shopkeepers, and attendees to connect and thrive.
          </p>
        </div>

        <div className="space-y-12 max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Our Vision</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                At EventFlow, we envision a world where planning and attending
                events is effortless and rewarding for everyone. We believe in
                the power of community and connection, and our platform is built
                to facilitate these experiences. We are dedicated to providing
                powerful tools that simplify event management, boost business
                for vendors, and help people discover unforgettable moments.
              </p>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center">
              <CardHeader>
                <CalendarDays className="h-12 w-12 text-primary mx-auto mb-4" />
                <CardTitle>For Organizers</CardTitle>
                <CardDescription>
                  Empowering you with the tools to create, manage, and promote
                  successful events.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <Store className="h-12 w-12 text-primary mx-auto mb-4" />
                <CardTitle>For Shopkeepers</CardTitle>
                <CardDescription>
                  Providing a platform to showcase your products and connect
                  with a targeted audience.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <Users className="h-12 w-12 text-primary mx-auto mb-4" />
                <CardTitle>For Attendees</CardTitle>
                <CardDescription>
                  Making it easy to discover, register for, and enjoy events
                  that matter to you.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
