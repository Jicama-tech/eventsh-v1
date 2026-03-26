import { Link } from "react-router-dom";
import Navbar from "@/components/ui/navbar";
import Footer from "@/components/ui/footer";
import SectionHeader from "@/components/ui/sectionHeader";
import { Calendar, User, ArrowRight, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  category: "events" | "tips" | "news";
  author: string;
  date: string;
  readTime: string;
  image: string;
}

const blogPosts: BlogPost[] = [
  {
    id: "1",
    title: "10 Tips for Hosting a Successful Virtual Event",
    excerpt:
      "Learn the best practices for engaging attendees and creating memorable virtual experiences that drive results.",
    category: "events",
    author: "Sarah Johnson",
    date: "Dec 1, 2024",
    readTime: "5 min read",
    image:
      "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&h=400&fit=crop",
  },
{
    id: "3",
    title: "The Future of Hybrid Events in 2025",
    excerpt:
      "Explore emerging trends and technologies shaping the future of in-person and virtual event experiences.",
    category: "events",
    author: "Emily Davis",
    date: "Nov 25, 2024",
    readTime: "6 min read",
    image:
      "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=600&h=400&fit=crop",
  },
  {
    id: "4",
    title: "Building Customer Loyalty Through Exceptional Service",
    excerpt:
      "Tips and strategies for creating lasting relationships with your customers and building brand advocates.",
    category: "tips",
    author: "Alex Thompson",
    date: "Nov 22, 2024",
    readTime: "4 min read",
    image:
      "https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&h=400&fit=crop",
  },
  {
    id: "5",
    title: "Eventsh Platform Update: New Features for Q4",
    excerpt:
      "We're excited to announce new features including advanced analytics, custom integrations, and more.",
    category: "news",
    author: "Eventsh Team",
    date: "Nov 20, 2024",
    readTime: "3 min read",
    image:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=400&fit=crop",
  },
];

const categoryColors = {
  events: "bg-accent/10 text-accent",
  tips: "bg-primary/10 text-primary",
  news: "bg-muted text-muted-foreground",
};

const Blog = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="pt-24 pb-16 gradient-hero">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground mb-6">
              Blog & Resources
            </h1>
            <p className="text-xl text-primary-foreground/80">
              Insights, tips, and news to help you grow your business
            </p>
          </div>
        </div>
      </section>

      {/* Featured Post */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <SectionHeader title="Featured Article" />
          <div className="max-w-5xl mx-auto">
            <Link to="#" className="group block">
              <div className="grid md:grid-cols-2 gap-8 bg-card rounded-3xl overflow-hidden shadow-card hover:shadow-hover transition-all duration-300 border border-border">
                <div className="aspect-video md:aspect-auto">
                  <img
                    src={blogPosts[0].image}
                    alt={blogPosts[0].title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-8 flex flex-col justify-center">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium w-fit mb-4",
                      categoryColors[blogPosts[0].category]
                    )}
                  >
                    <Tag size={12} />
                    {blogPosts[0].category}
                  </span>
                  <h2 className="text-2xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors">
                    {blogPosts[0].title}
                  </h2>
                  <p className="text-muted-foreground mb-4">
                    {blogPosts[0].excerpt}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User size={14} />
                      {blogPosts[0].author}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar size={14} />
                      {blogPosts[0].date}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* All Posts */}
      <section className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <SectionHeader
            title="Latest Articles"
            subtitle="Stay updated with our latest insights and announcements"
          />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {blogPosts.slice(1).map((post) => (
              <Link key={post.id} to="#" className="group">
                <div className="bg-card rounded-2xl overflow-hidden shadow-card hover:shadow-hover transition-all duration-300 hover:-translate-y-2 border border-border h-full flex flex-col">
                  <div className="aspect-video overflow-hidden">
                    <img
                      src={post.image}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-6 flex flex-col flex-1">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium w-fit mb-3",
                        categoryColors[post.category]
                      )}
                    >
                      <Tag size={12} />
                      {post.category}
                    </span>
                    <h3 className="text-lg font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                      {post.title}
                    </h3>
                    <p className="text-muted-foreground text-sm mb-4 flex-1">
                      {post.excerpt}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-border">
                      <span>{post.date}</span>
                      <span>{post.readTime}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Blog;
