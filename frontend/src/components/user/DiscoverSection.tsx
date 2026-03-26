import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Users, UserPlus, Star } from "lucide-react";

interface Organizer {
  id: string;
  name: string;
  description: string;
  events: number;
  followers: string;
  rating: number;
  isFollowing: boolean;
  categories: string[];
}

interface DiscoverSectionProps {
  organizers: Organizer[];
  onFollowOrganizer: (organizerId: string) => void;
}

export function DiscoverSection({
  organizers,
  onFollowOrganizer,
}: DiscoverSectionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = [
    "All",
    "Technology",
    "Music",
    "Food",
    "Sports",
    "Art",
    "Fashion",
    "Electronics",
  ];

  const filteredOrganizers = organizers.filter(
    (organizer) =>
      organizer.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      (selectedCategory === "All" ||
        organizer.categories.includes(selectedCategory))
  );

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Discover & Follow</h3>

        {/* Search and Filter */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search organizers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-2 flex-wrap">
          {categories.map((category) => (
            <Badge
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-4 w-4" />
          <span className="font-medium">Organizers ({filteredOrganizers.length})</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredOrganizers.map((organizer) => (
            <Card
              key={organizer.id}
              className="hover:shadow-md transition-shadow"
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <CardTitle className="text-lg">
                      {organizer.name}
                    </CardTitle>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{organizer.events} events</span>
                      <span>{organizer.followers} followers</span>
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span>{organizer.rating}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant={organizer.isFollowing ? "outline" : "default"}
                    size="sm"
                    onClick={() => onFollowOrganizer(organizer.id)}
                    className={
                      organizer.isFollowing
                        ? "text-red-600 hover:text-red-700 hover:bg-red-50"
                        : ""
                    }
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    {organizer.isFollowing ? "Unfollow" : "Follow"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="mb-3">
                  {organizer.description}
                </CardDescription>
                <div className="flex gap-1 flex-wrap">
                  {organizer.categories.map((category) => (
                    <Badge
                      key={category}
                      variant="secondary"
                      className="text-xs"
                    >
                      {category}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
