import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuthStore } from "@/lib/auth";
import api from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { useCurrency } from "@/lib/currency";
import { useFeedback } from "@/lib/feedback";
import { animateFlyToCart } from "@/lib/flyToCart";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FlowStateCard } from "@/components/ui/flow-state";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Heart,
  Minus,
  Plus,
  ShoppingCart,
  Star,
  Tag,
  Edit2,
  Trash2,
} from "lucide-react";

interface Product {
  id: number;
  name: string;
  description: string;
  price: string;
  image?: string;
  image_url?: string;
  stock: number;
  category: {
    id: number;
    name: string;
  };
}

interface ProductReview {
  id: number;
  user_name: string;
  product: number;
  rating: number;
  comment: string;
  created_at: string;
}

export function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { formatPrice } = useCurrency();
  const { showError, showSuccess } = useFeedback();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [myReviews, setMyReviews] = useState<ProductReview[]>([]);
  const [myReviewsLoading, setMyReviewsLoading] = useState(false);
  const [myReviewsError, setMyReviewsError] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewHoverRating, setReviewHoverRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  const [isEditingReview, setIsEditingReview] = useState(false);
  const [userReviewId, setUserReviewId] = useState<number | null>(null);
  const [canReviewProduct, setCanReviewProduct] = useState(false);
  const [checkingReviewEligibility, setCheckingReviewEligibility] =
    useState(false);
  const [productLoadError, setProductLoadError] = useState<
    "not-found" | "unavailable" | null
  >(null);
  const trackedProductViewRef = useRef<number | null>(null);

  const fetchProductDetail = async (productId: string) => {
    const endpoints = [
      `/products/${productId}/`,
      `/products/products/${productId}/`,
    ];

    let lastError: any = null;
    for (const endpoint of endpoints) {
      try {
        const response = await api.get(endpoint);
        return response.data;
      } catch (error: any) {
        lastError = error;
        if (error?.response?.status !== 404) {
          throw error;
        }
      }
    }

    throw lastError;
  };

  const getLocalCartCount = () => {
    const raw = localStorage.getItem("nobonir_demo_cart");
    if (!raw) {
      return 0;
    }

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return 0;
      }

      return parsed.reduce(
        (sum: number, item: any) => sum + (item.quantity || 0),
        0,
      );
    } catch {
      return 0;
    }
  };

  const refreshCartCount = async () => {
    try {
      const response = await api.get("/cart/");
      const apiItems = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.results)
          ? response.data.results
          : [];
      const apiCount = apiItems.reduce(
        (sum: number, item: any) => sum + (item.quantity || 0),
        0,
      );
      setCartCount(apiCount > 0 ? apiCount : getLocalCartCount());
    } catch {
      setCartCount(getLocalCartCount());
    }
  };

  const loadProductById = async (productId: string) => {
    setLoading(true);
    setProduct(null);
    setProductLoadError(null);

    try {
      const productData = await fetchProductDetail(productId);
      setProduct(productData);
    } catch (error: any) {
      console.error("Failed to load product details:", error);
      setProduct(null);

      if (error?.response?.status === 404) {
        setProductLoadError("not-found");
      } else {
        setProductLoadError("unavailable");
      }
    } finally {
      setLoading(false);
    }
  };

  const loadPublicReviews = async (productId: string) => {
    setReviewsLoading(true);
    setReviewsError(null);

    try {
      const response = await api.get("/reviews/", {
        params: { product: productId },
      });
      const reviewItems = response.data.results || response.data;
      setReviews(Array.isArray(reviewItems) ? reviewItems : []);
    } catch {
      setReviews([]);
      setReviewsError("Couldn’t load customer reviews.");
    } finally {
      setReviewsLoading(false);
    }
  };

  const loadMyReviews = async () => {
    if (!isAuthenticated) {
      setMyReviews([]);
      setMyReviewsError(null);
      setMyReviewsLoading(false);
      return;
    }

    setMyReviewsLoading(true);
    setMyReviewsError(null);

    try {
      const response = await api.get("/reviews/my/");
      const mine = response.data.results || response.data;
      setMyReviews(Array.isArray(mine) ? mine : []);
    } catch {
      setMyReviews([]);
      setMyReviewsError("Couldn’t load your review status.");
    } finally {
      setMyReviewsLoading(false);
    }
  };

  useEffect(() => {
    refreshCartCount();

    if (!id) {
      setProductLoadError("not-found");
      setLoading(false);
      return;
    }

    loadProductById(String(id));
  }, [id]);

  useEffect(() => {
    if (!id) {
      return;
    }

    loadPublicReviews(String(id));
  }, [id]);

  useEffect(() => {
    loadMyReviews();
  }, [isAuthenticated]);

  useEffect(() => {
    const checkReviewEligibility = async () => {
      if (!isAuthenticated || !id) {
        setCanReviewProduct(false);
        setCheckingReviewEligibility(false);
        return;
      }

      setCheckingReviewEligibility(true);

      try {
        const response = await api.get("/reviews/can-review/", {
          params: { product: id },
        });
        setCanReviewProduct(Boolean(response.data?.can_review));
      } catch {
        setCanReviewProduct(false);
      } finally {
        setCheckingReviewEligibility(false);
      }
    };

    checkReviewEligibility();
  }, [isAuthenticated, id]);

  const currentProductId = Number(product?.id || 0);
  const currentUserReview = myReviews.find(
    (review) => Number(review.product) === currentProductId,
  );
  const hasReviewedProduct = myReviews.some(
    (review) => Number(review.product) === currentProductId,
  );
  const reviewFormLocked =
    !isAuthenticated ||
    savingReview ||
    (!hasReviewedProduct && !canReviewProduct) ||
    (hasReviewedProduct && !isEditingReview);

  useEffect(() => {
    if (!product || isEditingReview) {
      return;
    }

    const userReview = myReviews.find(
      (review) => Number(review.product) === Number(product.id),
    );

    if (userReview) {
      setUserReviewId(userReview.id);
      setReviewRating(userReview.rating || 5);
      setReviewComment(userReview.comment || "");
    } else {
      setUserReviewId(null);
      setReviewRating(5);
      setReviewComment("");
    }
  }, [product, myReviews, isEditingReview]);

  useEffect(() => {
    if (!product) {
      return;
    }

    if (trackedProductViewRef.current === product.id) {
      return;
    }

    trackedProductViewRef.current = product.id;
    void trackEvent("view_product", {
      product_id: product.id,
      category_id: product.category?.id,
      price: product.price,
      stock: product.stock,
    });

    if (window.location.hash === "#share-feedback") {
      window.setTimeout(() => {
        document
          .getElementById("share-feedback")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);

      if (hasReviewedProduct) {
        setIsEditingReview(true);
      }
    }
  }, [product, hasReviewedProduct]);

  const addToCart = async (sourceElement?: HTMLElement) => {
    if (!product) {
      return;
    }

    const productImage =
      product.image_url ||
      product.image ||
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&h=700&fit=crop";

    animateFlyToCart({
      fromElement: sourceElement,
      imageSrc: productImage,
    });

    const addToLocalDemoCart = () => {
      const key = "nobonir_demo_cart";
      const existingRaw = localStorage.getItem(key);
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      const existingIndex = existing.findIndex(
        (item: any) => item.product.id === product.id,
      );

      if (existingIndex >= 0) {
        existing[existingIndex].quantity += quantity;
      } else {
        existing.push({
          id: product.id,
          quantity,
          isLocal: true,
          product: {
            id: product.id,
            name: product.name,
            price: product.price,
            image: productImage,
            stock: product.stock,
          },
        });
      }

      localStorage.setItem(key, JSON.stringify(existing));
    };

    let cartMode: "server" | "local" = "server";

    try {
      await api.post("/cart/items/", {
        product_id: product.id,
        quantity,
      });
    } catch {
      cartMode = "local";
      addToLocalDemoCart();
    }

    await refreshCartCount();
    void trackEvent("add_to_cart", {
      product_id: product.id,
      quantity,
      stock: product.stock,
      cart_mode: cartMode,
      is_authenticated: isAuthenticated,
    });
  };

  const submitReview = async () => {
    if (!product) {
      return;
    }

    if (!isAuthenticated) {
      showError("Please sign in to submit a review");
      return;
    }

    if (!hasReviewedProduct && !canReviewProduct) {
      showError("You can review only products from your delivered orders");
      return;
    }

    setSavingReview(true);
    try {
      if ((isEditingReview || hasReviewedProduct) && userReviewId) {
        // Update existing review
        await api.patch(`/reviews/my/${userReviewId}/`, {
          rating: reviewRating,
          comment: reviewComment,
        });
        showSuccess("Review updated successfully");
      } else {
        // Create new review
        await api.post("/reviews/", {
          product: product.id,
          rating: reviewRating,
          comment: reviewComment,
        });
        showSuccess("Review submitted successfully");
      }

      setReviewComment("");
      setReviewRating(5);
      setIsEditingReview(false);
      setUserReviewId(null);
      await Promise.all([
        loadPublicReviews(String(product.id)),
        isAuthenticated ? loadMyReviews() : Promise.resolve(),
      ]);
    } catch (error: any) {
      showError(
        error.response?.data?.detail ||
          error.response?.data?.product?.[0] ||
          "Failed to submit review",
      );
    } finally {
      setSavingReview(false);
    }
  };

  const deleteReview = async () => {
    if (!userReviewId || !product) return;

    if (!window.confirm("Are you sure you want to delete your review?")) {
      return;
    }

    setSavingReview(true);
    try {
      await api.delete(`/reviews/my/${userReviewId}/`);
      showSuccess("Review deleted successfully");
      setReviewComment("");
      setReviewRating(5);
      setIsEditingReview(false);
      setUserReviewId(null);
      await Promise.all([
        loadPublicReviews(String(product.id)),
        isAuthenticated ? loadMyReviews() : Promise.resolve(),
      ]);
    } catch (error: any) {
      showError(error.response?.data?.detail || "Failed to delete review");
    } finally {
      setSavingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background px-4 py-16">
        <main className="mx-auto max-w-4xl">
          <FlowStateCard
            message="Loading product..."
            contentClassName="py-12"
          />
        </main>
      </div>
    );
  }

  if (!product) {
    const isUnavailable = productLoadError === "unavailable";

    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <FlowStateCard
            title={
              isUnavailable
                ? "Can’t load product right now"
                : "Product not found"
            }
            message={
              isUnavailable
                ? "Server is temporarily unavailable. Please try again."
                : "This product is unavailable right now."
            }
            actionLabel={isUnavailable ? "Try Again" : "Back to Products"}
            onAction={() => {
              if (isUnavailable) {
                if (id) {
                  void loadProductById(String(id));
                }
                return;
              }
              navigate("/");
            }}
            children={
              isUnavailable ? (
                <div className="mt-3">
                  <Link to="/">
                    <Button>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to Products
                    </Button>
                  </Link>
                </div>
              ) : null
            }
            contentClassName="py-12"
          />
        </main>
      </div>
    );
  }

  const productImage =
    product.image_url ||
    product.image ||
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&h=700&fit=crop";
  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) /
        reviews.length
      : 0;

  return (
    <div className="ds-page bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="ds-page-header">
        <div className="ds-page-header-row">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Link to="/cart">
            <Button variant="outline" className="relative" data-cart-nav="true">
              <ShoppingCart className="mr-2 h-4 w-4" />
              View Cart
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-teal-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex items-center justify-center">
            <img
              src={productImage}
              alt={product.name}
              className="max-w-full h-auto object-contain rounded-xl shadow-xl"
            />
          </div>

          <Card className="bg-card/95 shadow-xl">
            <CardContent className="p-5 sm:p-8">
              <Badge variant="secondary" className="mb-4 gap-1.5">
                <Tag className="h-3 w-3" />
                {product.category.name}
              </Badge>

              <h1 className="mb-4 text-3xl font-black text-foreground sm:text-4xl">
                {product.name}
              </h1>

              <p className="text-muted-foreground leading-relaxed mb-6">
                {product.description}
              </p>

              <p className="text-4xl font-black bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 bg-clip-text text-transparent mb-6">
                {formatPrice(product.price)}
              </p>

              <p className="text-sm text-muted-foreground mb-6">
                Stock: {product.stock}
              </p>

              <div className="mb-6">
                <p className="text-sm text-muted-foreground mb-2">Quantity</p>
                <div className="inline-flex items-center rounded-lg border bg-background">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-r-none"
                    onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                    disabled={quantity <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-12 text-center font-semibold">
                    {quantity}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-l-none"
                    onClick={() =>
                      setQuantity((prev) =>
                        Math.min(product.stock || 1, prev + 1),
                      )
                    }
                    disabled={quantity >= product.stock || product.stock === 0}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Button
                  onClick={(e) => addToCart(e.currentTarget)}
                  disabled={product.stock === 0}
                  className="bg-gradient-to-r from-teal-500 via-cyan-600 to-blue-600 hover:from-teal-600 hover:via-cyan-700 hover:to-blue-700"
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  {product.stock === 0 ? "Unavailable" : "Add to Cart"}
                </Button>
                <Button variant="outline" onClick={() => navigate("/wishlist")}>
                  <Heart className="mr-2 h-4 w-4" />
                  Wishlist
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card id="share-feedback" className="bg-card/95 shadow-xl">
            <CardContent className="p-5 sm:p-6">
              <h3 className="text-xl font-bold text-foreground">
                Customer Reviews
              </h3>
              {reviewsLoading ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  Loading customer reviews...
                </p>
              ) : reviewsError ? (
                <p className="mt-1 text-sm text-rose-600">{reviewsError}</p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  {reviews.length > 0
                    ? `${averageRating.toFixed(1)} / 5 average from ${reviews.length} review(s)`
                    : "No reviews yet"}
                </p>
              )}

              <div className="mt-4 space-y-3">
                {reviewsLoading ? (
                  <p className="text-sm text-muted-foreground">
                    Fetching reviews...
                  </p>
                ) : reviewsError ? (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3">
                    <p className="text-sm text-rose-600">{reviewsError}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => id && loadPublicReviews(String(id))}
                    >
                      Retry Reviews
                    </Button>
                  </div>
                ) : reviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Be the first to review this product.
                  </p>
                ) : (
                  reviews.map((review) => (
                    <div key={review.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">
                          {review.user_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(review.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="mt-1 inline-flex items-center gap-1 text-amber-500">
                        {Array.from({ length: 5 }).map((_, index) => (
                          <Star
                            key={`star-${review.id}-${index}`}
                            className={`h-4 w-4 ${index < review.rating ? "fill-current" : "opacity-30"}`}
                          />
                        ))}
                      </div>
                      {review.comment && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {review.comment}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/95 shadow-xl">
            <CardContent className="p-5 sm:p-6">
              <h3 className="text-xl font-bold text-foreground">
                Share Your Feedback
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Help other customers by sharing your experience with this
                product.
              </p>

              {!isAuthenticated && (
                <div className="mt-4 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-300">
                  <p className="font-medium">Sign in to review</p>
                  <p className="mt-1">
                    You must be logged in to leave a review.
                  </p>
                </div>
              )}

              {isAuthenticated && !hasReviewedProduct && !canReviewProduct && (
                <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                  <p className="font-medium">Verified purchase required</p>
                  <p className="mt-1">
                    You can review this product after receiving a delivered
                    order containing it.
                  </p>
                </div>
              )}

              {isAuthenticated && !hasReviewedProduct && canReviewProduct && (
                <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                  <p className="font-medium">✓ You can review this product</p>
                  <p className="mt-1">
                    Your delivered order includes this item. Share your feedback
                    below.
                  </p>
                </div>
              )}

              {isAuthenticated && hasReviewedProduct && (
                <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                  <p className="font-medium">✓ You've reviewed this product</p>
                  <p className="mt-1">
                    You can edit or delete your review below.
                  </p>
                  <div className="mt-3 rounded-md border border-green-500/30 bg-green-500/5 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-green-300/90">
                        Your current review
                      </p>
                      <span className="text-xs text-green-300/80">
                        {currentUserReview
                          ? new Date(
                              currentUserReview.created_at,
                            ).toLocaleDateString()
                          : ""}
                      </span>
                    </div>
                    <div className="mt-2 inline-flex items-center gap-1 text-amber-400">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Star
                          key={`current-user-review-star-${index}`}
                          className={`h-4 w-4 ${
                            index < (currentUserReview?.rating || 0)
                              ? "fill-current"
                              : "opacity-35"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="mt-2 text-sm text-green-100/90">
                      {currentUserReview?.comment || "No comment provided."}
                    </p>
                  </div>
                </div>
              )}

              {checkingReviewEligibility && isAuthenticated && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Checking review eligibility...
                </p>
              )}

              {isAuthenticated && myReviewsLoading && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Loading your review data...
                </p>
              )}

              {isAuthenticated && myReviewsError && (
                <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600">
                  <p>{myReviewsError}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={loadMyReviews}
                  >
                    Retry Review Status
                  </Button>
                </div>
              )}

              <div className="mt-6 space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-foreground">
                      Your Rating
                    </label>
                    <span className="text-sm font-medium text-amber-500">
                      {reviewRating === 5
                        ? "⭐ Excellent"
                        : reviewRating === 4
                          ? "⭐ Good"
                          : reviewRating === 3
                            ? "⭐ Fair"
                            : reviewRating === 2
                              ? "⭐ Poor"
                              : "⭐ Terrible"}
                    </span>
                  </div>
                  <div className="mt-3 rounded-lg border border-border/60 bg-background/40 p-4">
                    <div className="flex items-center gap-2">
                      {Array.from({ length: 5 }).map((_, index) => {
                        const value = index + 1;
                        const active =
                          (reviewHoverRating || reviewRating) >= value;

                        return (
                          <button
                            key={`write-review-star-${value}`}
                            type="button"
                            onMouseEnter={() => setReviewHoverRating(value)}
                            onMouseLeave={() => setReviewHoverRating(0)}
                            onClick={() => setReviewRating(value)}
                            disabled={reviewFormLocked}
                            className="rounded-lg p-2 transition-transform duration-200 hover:scale-125 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Rate ${value} star${value > 1 ? "s" : ""}`}
                          >
                            <Star
                              className={`h-7 w-7 transition-all duration-200 ${
                                active
                                  ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                                  : "text-muted-foreground"
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-foreground">
                      Your Review
                    </label>
                    <span className="text-xs text-muted-foreground">
                      {reviewComment.length}/500
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Share your honest thoughts about quality, value, and overall
                    experience.
                  </p>
                  <Textarea
                    rows={4}
                    placeholder="What did you like? What could be improved? (Optional)"
                    value={reviewComment}
                    onChange={(event) =>
                      setReviewComment(event.target.value.slice(0, 500))
                    }
                    disabled={reviewFormLocked}
                    className="mt-2"
                  />
                </div>
                <Button
                  onClick={submitReview}
                  disabled={
                    reviewFormLocked ||
                    myReviewsLoading ||
                    Boolean(myReviewsError)
                  }
                  className="w-full bg-gradient-to-r from-teal-500 via-cyan-600 to-blue-600 hover:from-teal-600 hover:via-cyan-700 hover:to-blue-700"
                >
                  {savingReview
                    ? isEditingReview
                      ? "Updating..."
                      : "Submitting..."
                    : myReviewsLoading
                      ? "Loading review status..."
                      : myReviewsError
                        ? "Retry review status to continue"
                        : isEditingReview
                          ? "Update Review"
                          : hasReviewedProduct
                            ? "Click Edit Review to Update"
                            : isAuthenticated &&
                                !hasReviewedProduct &&
                                !canReviewProduct
                              ? "Delivered Order Required"
                              : isAuthenticated
                                ? "Submit Review"
                                : "Login to Review"}
                </Button>

                {isAuthenticated && hasReviewedProduct && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setIsEditingReview(!isEditingReview)}
                      variant="outline"
                      className="flex-1"
                      disabled={savingReview}
                    >
                      <Edit2 className="mr-2 h-4 w-4" />
                      {isEditingReview ? "Cancel Edit" : "Edit Review"}
                    </Button>
                    <Button
                      onClick={deleteReview}
                      variant="outline"
                      className="flex-1 border-red-500/40 text-red-500 hover:bg-red-500/10 hover:text-red-400"
                      disabled={savingReview}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
