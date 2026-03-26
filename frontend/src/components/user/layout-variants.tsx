/**
 * Layout Variants for Storefront
 * Modern, Magazine, Minimal, Grid
 * Data and theme are reused - only layout structure changes
 */

import {
  Clock,
  Globe,
  Instagram,
  Mail,
  MapPin,
  Phone,
  Share2,
} from "lucide-react";
import { Button } from "../ui/button";
import { FaWhatsapp } from "react-icons/fa";

// ============================================================================
// MODERN LAYOUT (Current - Hero + Featured + Carousel + Products)
// ============================================================================
export const ModernLayout = ({
  settings,
  design,
  general,
  features,
  products,
  featuredProduct,
  carouselProducts,
  quickPickProducts,
  filteredProducts,
  handleProductClick,
  scrollToSection,
  sidebarOpen,
  setSidebarOpen,
  cartCount,
  handleCartClick,
  currentSlide,
  setCurrentSlide,
  totalSlides,
  prevSlide,
  nextSlide,
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  isProductAvailable,
  getImageUrl,
  getDisplayPrice,
  themeStyles,
  selectedProductId,
  showProductDialog,
  setShowProductDialog,
  setSelectedProductId,
  onShare,
  whatsAppNumber,
  newsletterEmail,
  setNewsletterEmail,
  getBannerHeight,
}: any) => {
  return (
    <div className="min-h-screen bg-background">
      {/* Your existing modern layout JSX here */}
      {/* Keep all the current code as-is */}
    </div>
  );
};

// ============================================================================
// MAGAZINE LAYOUT (Hero + Full-width Featured + 3-column Products + Grid)
// ============================================================================
export const MagazineLayout = ({
  settings,
  design,
  general,
  features,
  products,
  featuredProduct,
  carouselProducts,
  quickPickProducts,
  filteredProducts,
  handleProductClick,
  scrollToSection,
  sidebarOpen,
  setSidebarOpen,
  cartCount,
  handleCartClick,
  currentSlide,
  setCurrentSlide,
  totalSlides,
  prevSlide,
  nextSlide,
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  isProductAvailable,
  getImageUrl,
  getDisplayPrice,
  themeStyles,
  selectedProductId,
  showProductDialog,
  setShowProductDialog,
  setSelectedProductId,
  onShare,
  whatsAppNumber,
  newsletterEmail,
  setNewsletterEmail,
  getBannerHeight,
}: any) => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center space-x-3">
              {general.logo ? (
                <img
                  src={getImageUrl(general.logo)}
                  alt="Logo"
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg"
                />
              ) : (
                <div
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: design.primaryColor }}
                >
                  {general.storeName.charAt(0).toUpperCase()}
                </div>
              )}
              <h1
                className="font-bold text-base sm:text-lg"
                style={{ fontFamily: design.fontFamily }}
              >
                {general.storeName}
              </h1>
            </div>

            <div className="flex items-center space-x-3">
              {features.showWishlist && (
                <button className="p-2 hover:bg-gray-100 rounded-lg">♡</button>
              )}
              <button
                onClick={handleCartClick}
                className="relative p-2 hover:bg-gray-100 rounded-lg"
              >
                🛒
                {cartCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: design.primaryColor }}
                  >
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div style={themeStyles} className="text-foreground">
        {/* Magazine Hero - Full Width */}
        {design.showBanner && (
          <section
            id="home"
            className="relative overflow-hidden"
            style={{ height: getBannerHeight() }}
          >
            {design.bannerImage && (
              <>
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: `url("${getImageUrl(
                      design.bannerImage
                    )}")`,
                  }}
                />
                <div className="absolute inset-0 bg-black/40" />
              </>
            )}
            <div className="relative h-full flex items-center justify-center">
              <div className="text-center text-white px-4">
                <h1
                  className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4"
                  style={{ fontFamily: design.fontFamily }}
                >
                  {general.storeName}
                </h1>
                <p className="text-lg sm:text-xl mb-8">{general.tagline}</p>
                <button
                  onClick={() => scrollToSection("products")}
                  className="px-8 py-3 rounded-lg font-semibold text-white"
                  style={{ backgroundColor: design.primaryColor }}
                >
                  Shop Now
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Magazine Featured - Full Width Article Style */}
        {featuredProduct && (
          <section className="py-16 bg-gradient-to-r from-gray-50 to-white">
            <div className="max-w-6xl mx-auto px-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                {/* Large Image Left */}
                <div className="md:col-span-2">
                  <img
                    src={getImageUrl(featuredProduct.images?.[0])}
                    alt={featuredProduct.name}
                    className="w-full h-96 object-cover rounded-xl shadow-xl"
                  />
                </div>

                {/* Content Right */}
                <div className="space-y-6">
                  <div>
                    <span
                      className="inline-block px-4 py-2 rounded-full text-white text-sm font-semibold mb-4"
                      style={{ backgroundColor: design.primaryColor }}
                    >
                      Featured
                    </span>
                    <h2
                      className="text-3xl font-bold mb-3"
                      style={{ fontFamily: design.fontFamily }}
                    >
                      {featuredProduct.name}
                    </h2>
                    <p className="text-gray-600 text-lg">
                      {featuredProduct.description}
                    </p>
                  </div>

                  <div
                    className="text-4xl font-bold"
                    style={{ color: design.primaryColor }}
                  >
                    {getDisplayPrice(featuredProduct)}
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={() => handleProductClick(featuredProduct._id)}
                      className="flex-1 py-3 rounded-lg text-white font-semibold"
                      style={{ backgroundColor: design.primaryColor }}
                    >
                      Add to Cart
                    </button>
                    <button className="flex-1 py-3 rounded-lg border-2 font-semibold">
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Magazine Grid - 3 Columns */}
        <section id="products" className="py-16">
          <div className="max-w-7xl mx-auto px-4">
            <h2
              className="text-4xl font-bold mb-12 text-center"
              style={{ fontFamily: design.fontFamily }}
            >
              Our Collection
            </h2>

            {/* Search & Filter */}
            {(features.showSearch || features.showFilters) && (
              <div className="mb-8 flex gap-4">
                {features.showSearch && (
                  <input
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 px-4 py-2 border rounded-lg"
                  />
                )}
                {features.showFilters && (
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-4 py-2 border rounded-lg"
                  >
                    <option value="featured">Featured</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                  </select>
                )}
              </div>
            )}

            {/* 3-Column Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {filteredProducts?.map((product) => (
                <div
                  key={product._id}
                  onClick={() => handleProductClick(product._id)}
                  className="group cursor-pointer"
                >
                  <div className="relative overflow-hidden rounded-lg mb-4">
                    <img
                      src={getImageUrl(product.images?.[0])}
                      alt={product.name}
                      className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <h3 className="font-bold text-lg mb-2">{product.name}</h3>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {product.description}
                  </p>
                  <div className="flex justify-between items-center">
                    <span
                      className="font-bold text-lg"
                      style={{ color: design.primaryColor }}
                    >
                      {getDisplayPrice(product)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleProductClick(product._id);
                      }}
                      className="px-4 py-2 rounded-lg text-white"
                      style={{ backgroundColor: design.primaryColor }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Newsletter */}
        {features.showNewsletter && (
          <section
            className="py-16"
            style={{ backgroundColor: `${design.primaryColor}15` }}
          >
            <div className="max-w-2xl mx-auto px-4 text-center">
              <h2 className="text-3xl font-bold mb-4">Stay Updated</h2>
              <div className="flex gap-2">
                <input
                  placeholder="Enter your email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  className="flex-1 px-4 py-2 rounded-lg border"
                />
                <button
                  className="px-6 py-2 rounded-lg text-white font-semibold"
                  style={{ backgroundColor: design.primaryColor }}
                >
                  Subscribe
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer id="about" className="bg-card border-t py-8 sm:py-12 lg:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* About Us */}
            <div className="mb-8 sm:mb-12 lg:mb-16">
              <div className="text-center mb-8 sm:mb-12">
                <h2
                  className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4"
                  style={{ fontFamily: design.fontFamily }}
                >
                  About Us
                </h2>
                <p className="text-sm sm:text-base lg:text-lg text-muted-foreground max-w-3xl mx-auto">
                  {general.description ||
                    `Welcome to ${general.storeName}! We are dedicated to providing you with the best products and exceptional customer service. Our mission is to make your shopping experience memorable and enjoyable.`}
                </p>
              </div>
            </div>

            {/* Main Footer Details */}
            <div
              id="contact"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 mb-8 sm:mb-12"
            >
              {/* Logo & Social */}
              <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                <div className="flex items-center space-x-3">
                  {general.logo ? (
                    <img
                      src={getImageUrl(general.logo)}
                      alt="Logo"
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        e.currentTarget.nextElementSibling?.classList.remove(
                          "hidden"
                        );
                      }}
                    />
                  ) : null}
                  <div
                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg sm:text-xl ${
                      general.logo ? "hidden" : ""
                    }`}
                    style={{ backgroundColor: design.primaryColor }}
                  >
                    {general.storeName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3
                      className="font-bold text-lg sm:text-xl"
                      style={{ fontFamily: design.fontFamily }}
                    >
                      {general.storeName}
                    </h3>
                    <p className="text-sm sm:text-base text-muted-foreground">
                      {general.tagline}
                    </p>
                  </div>
                </div>

                {features.showSocialMedia && (
                  <div className="flex space-x-3">
                    {/* <Button variant="outline" className="rounded-lg p-2">
                      <Facebook className="h-4 w-4 sm:h-5 sm:w-5" />
                    </Button>
                    <Button variant="outline" className="rounded-lg p-2">
                      <Twitter className="h-4 w-4 sm:h-5 sm:w-5" />
                    </Button> */}
                    <a
                      href={general.contactInfo.instagramLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-lg p-2 border border-gray-200 text-current hover:bg-gray transition-colors"
                      aria-label="Instagram"
                    >
                      <Instagram className="h-4 w-4 sm:h-5 sm:w-5" />
                    </a>

                    <Button
                      variant="outline"
                      className="rounded-lg p-2"
                      onClick={onShare} // Implement onShare function as shared earlier
                      aria-label="Share store link"
                    >
                      <Share2 className="h-4 w-4 sm:h-5 sm:w-5" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Contact Info */}
              <div>
                <h4 className="font-semibold mb-3 sm:mb-4 text-base sm:text-lg">
                  Contact Info
                </h4>
                <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-muted-foreground">
                  {general.contactInfo.phone && (
                    <div className="flex items-center space-x-3">
                      <Phone
                        className="h-3 w-3 sm:h-4 sm:w-4"
                        style={{ color: design.primaryColor }}
                      />
                      <span>{general.contactInfo.phone}</span>
                    </div>
                  )}
                  {whatsAppNumber && (
                    <div className="flex items-center space-x-3">
                      <FaWhatsapp className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                      <a
                        href={`https://wa.me/${whatsAppNumber.replace(
                          /\D/g,
                          ""
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 font-medium"
                      >
                        Chat on WhatsApp
                      </a>
                    </div>
                  )}
                  {general.contactInfo.email && (
                    <div className="flex items-center space-x-3">
                      <Mail
                        className="h-3 w-3 sm:h-4 sm:w-4"
                        style={{ color: design.primaryColor }}
                      />
                      <span className="break-all">
                        {general.contactInfo.email}
                      </span>
                    </div>
                  )}
                  {general.contactInfo.address && (
                    <div className="flex items-center space-x-3">
                      <MapPin
                        className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0"
                        style={{ color: design.primaryColor }}
                      />
                      <span>{general.contactInfo.address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Store Hours/Website */}
              <div>
                <h4 className="font-semibold mb-3 sm:mb-4 text-base sm:text-lg">
                  Store Hours
                </h4>
                <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-muted-foreground">
                  {general.contactInfo.hours && (
                    <div className="flex items-center space-x-3">
                      <Clock
                        className="h-3 w-3 sm:h-4 sm:w-4"
                        style={{ color: design.primaryColor }}
                      />
                      <span>{general.contactInfo.hours}</span>
                    </div>
                  )}
                  {general.contactInfo.website && (
                    <div className="flex items-center space-x-3">
                      <Globe
                        className="h-3 w-3 sm:h-4 sm:w-4"
                        style={{ color: design.primaryColor }}
                      />
                      <a
                        href={
                          general.contactInfo.website.startsWith("http")
                            ? general.contactInfo.website
                            : `https://${general.contactInfo.website}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-black-600"
                      >
                        {general.contactInfo.website}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Bar with Admin Login */}
            <div className="border-t pt-6 sm:pt-8 flex flex-col md:flex-row items-center justify-between text-xs sm:text-sm text-muted-foreground">
              <p>
                &copy; 2025 {general.storeName}. All rights reserved. Powered by
                EventSH
              </p>
              <a
                href="/shopkeeper-login"
                className="text-black font-semibold hover:underline mt-2 md:mt-0"
              >
                Admin Login
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

// ============================================================================
// MINIMAL LAYOUT (Minimal Header + Sidebar + 2-column Products)
// ============================================================================
export const MinimalLayout = ({
  settings,
  design,
  general,
  features,
  products,
  featuredProduct,
  carouselProducts,
  quickPickProducts,
  filteredProducts,
  handleProductClick,
  scrollToSection,
  sidebarOpen,
  setSidebarOpen,
  cartCount,
  handleCartClick,
  currentSlide,
  setCurrentSlide,
  totalSlides,
  prevSlide,
  nextSlide,
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  isProductAvailable,
  getImageUrl,
  getDisplayPrice,
  themeStyles,
  selectedProductId,
  showProductDialog,
  setShowProductDialog,
  setSelectedProductId,
  onShare,
  whatsAppNumber,
  newsletterEmail,
  setNewsletterEmail,
  getBannerHeight,
}: any) => {
  return (
    <div className="min-h-screen bg-white">
      {/* Minimal Header */}
      <header className="border-b py-4">
        <div className="max-w-7xl mx-auto px-4 flex justify-between items-center">
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: design.fontFamily }}
          >
            {general.storeName}
          </h1>
          <button
            onClick={handleCartClick}
            className="relative px-4 py-2 border rounded"
          >
            Cart ({cartCount})
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="col-span-1">
            <div className="space-y-4">
              <h3 className="font-bold text-lg mb-4">Filters</h3>

              {features.showSearch && (
                <input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm"
                />
              )}

              {features.showFilters && (
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm"
                >
                  <option value="featured">Featured</option>
                  <option value="price-low">Price: Low</option>
                  <option value="price-high">Price: High</option>
                </select>
              )}

              {/* Categories */}
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-2 text-sm">Categories</h4>
                <div className="space-y-1 text-sm">
                  <div className="cursor-pointer hover:text-blue-600">
                    All Products
                  </div>
                  <div className="cursor-pointer hover:text-blue-600">
                    New Arrivals
                  </div>
                  <div className="cursor-pointer hover:text-blue-600">Sale</div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content - 2 Columns */}
          <div className="col-span-3">
            <div className="grid grid-cols-2 gap-6">
              {filteredProducts?.map((product) => (
                <div
                  key={product._id}
                  onClick={() => handleProductClick(product._id)}
                  className="border rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition"
                >
                  <img
                    src={getImageUrl(product.images?.[0])}
                    alt={product.name}
                    className="w-full h-48 object-cover"
                  />
                  <div className="p-4">
                    <h3 className="font-semibold mb-2">{product.name}</h3>
                    <p className="text-gray-600 text-sm mb-3 line-clamp-1">
                      {product.description}
                    </p>
                    <div className="flex justify-between items-center">
                      <span
                        className="font-bold"
                        style={{ color: design.primaryColor }}
                      >
                        {getDisplayPrice(product)}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleProductClick(product._id);
                        }}
                        className="px-3 py-1 bg-gray-200 rounded text-sm hover:bg-gray-300"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-50 border-t mt-12 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-600">
          <p>&copy; 2025 {general.storeName}</p>
        </div>
      </footer>
    </div>
  );
};

// ============================================================================
// GRID LAYOUT (Hero + Full Grid + Showcase)
// ============================================================================
export const GridLayout = ({
  settings,
  design,
  general,
  features,
  products,
  featuredProduct,
  carouselProducts,
  quickPickProducts,
  filteredProducts,
  handleProductClick,
  scrollToSection,
  sidebarOpen,
  setSidebarOpen,
  cartCount,
  handleCartClick,
  currentSlide,
  setCurrentSlide,
  totalSlides,
  prevSlide,
  nextSlide,
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  isProductAvailable,
  getImageUrl,
  getDisplayPrice,
  themeStyles,
  selectedProductId,
  showProductDialog,
  setShowProductDialog,
  setSelectedProductId,
  onShare,
  whatsAppNumber,
  newsletterEmail,
  setNewsletterEmail,
  getBannerHeight,
}: any) => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">{general.storeName}</h1>
          <button
            onClick={handleCartClick}
            className="relative px-4 py-2 border rounded"
          >
            🛒 {cartCount}
          </button>
        </div>
      </header>

      {/* Hero */}
      {design.showBanner && (
        <section
          className="relative overflow-hidden"
          style={{ height: getBannerHeight() }}
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url("${getImageUrl(design.bannerImage)}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative h-full flex items-center justify-center text-center text-white">
            <div>
              <h1 className="text-5xl font-bold mb-4">{general.storeName}</h1>
              <button
                onClick={() => scrollToSection("products")}
                className="px-8 py-3 rounded-lg text-white font-semibold"
                style={{ backgroundColor: design.primaryColor }}
              >
                Explore
              </button>
            </div>
          </div>
        </section>
      )}

      <div style={themeStyles}>
        {/* Featured Spotlight */}
        {featuredProduct && (
          <section className="py-16 bg-gradient-to-r from-white to-gray-50">
            <div className="max-w-7xl mx-auto px-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <img
                  src={getImageUrl(featuredProduct.images?.[0])}
                  alt={featuredProduct.name}
                  className="w-full rounded-2xl shadow-2xl"
                />
                <div>
                  <span
                    className="inline-block px-4 py-1 rounded-full text-white text-sm font-semibold mb-4"
                    style={{ backgroundColor: design.primaryColor }}
                  >
                    Featured
                  </span>
                  <h2 className="text-4xl font-bold mb-4">
                    {featuredProduct.name}
                  </h2>
                  <p className="text-gray-600 mb-6">
                    {featuredProduct.description}
                  </p>
                  <div
                    className="text-3xl font-bold mb-6"
                    style={{ color: design.primaryColor }}
                  >
                    {getDisplayPrice(featuredProduct)}
                  </div>
                  <button
                    onClick={() => handleProductClick(featuredProduct._id)}
                    className="w-full py-3 rounded-lg text-white font-semibold"
                    style={{ backgroundColor: design.primaryColor }}
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Products Section */}
        <section id="products" className="py-16">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2
                className="text-4xl font-bold mb-4"
                style={{ fontFamily: design.fontFamily }}
              >
                All Products
              </h2>
              {(features.showSearch || features.showFilters) && (
                <div className="flex gap-4 max-w-md mx-auto">
                  {features.showSearch && (
                    <input
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 px-4 py-2 border rounded-lg"
                    />
                  )}
                  {features.showFilters && (
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="px-4 py-2 border rounded-lg"
                    >
                      <option value="featured">Sort</option>
                      <option value="price-low">Price Low</option>
                      <option value="price-high">Price High</option>
                    </select>
                  )}
                </div>
              )}
            </div>

            {/* 4-Column Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredProducts?.map((product) => (
                <div
                  key={product._id}
                  onClick={() => handleProductClick(product._id)}
                  className="group bg-white rounded-xl overflow-hidden shadow hover:shadow-xl transition cursor-pointer"
                >
                  <div className="relative overflow-hidden h-48">
                    <img
                      src={getImageUrl(product.images?.[0])}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold mb-2 line-clamp-1">
                      {product.name}
                    </h3>
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                      {product.description}
                    </p>
                    <div className="flex justify-between items-center">
                      <span
                        className="font-bold text-lg"
                        style={{ color: design.primaryColor }}
                      >
                        {getDisplayPrice(product)}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleProductClick(product._id);
                        }}
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                        style={{ backgroundColor: design.primaryColor }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-900 text-white py-12 mt-16">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
              <div>
                <h3 className="font-bold mb-4">About</h3>
                <p className="text-gray-400 text-sm">{general.description}</p>
              </div>
              <div>
                <h3 className="font-bold mb-4">Contact</h3>
                <p className="text-gray-400 text-sm">
                  {general.contactInfo.phone}
                </p>
              </div>
              <div>
                <h3 className="font-bold mb-4">Hours</h3>
                <p className="text-gray-400 text-sm">
                  {general.contactInfo.hours}
                </p>
              </div>
            </div>
            <div className="border-t pt-8 text-center text-gray-400 text-sm">
              <p>&copy; 2025 {general.storeName}. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
