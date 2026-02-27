import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "@/lib/api";
import { useFeedback } from "@/lib/feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Category {
  id: number;
  name: string;
}

interface ProductPayload {
  category_id: string;
  name: string;
  slug: string;
  description: string;
  price: string;
  stock: string;
  image_url: string;
  is_active: boolean;
}

const EMPTY_FORM: ProductPayload = {
  category_id: "",
  name: "",
  slug: "",
  description: "",
  price: "",
  stock: "0",
  image_url: "",
  is_active: true,
};

function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function AdminProductFormPage() {
  const { id } = useParams();
  const isEditMode = Boolean(id && id !== "new");
  const navigate = useNavigate();
  const { showError, showSuccess } = useFeedback();

  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<ProductPayload>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const title = useMemo(
    () => (isEditMode ? "Edit Product" : "Add Product"),
    [isEditMode],
  );

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const categoriesResponse = await api.get("/products/categories/");
        const categoryItems =
          categoriesResponse.data.results || categoriesResponse.data;
        setCategories(categoryItems);

        if (isEditMode && id) {
          const productResponse = await api.get(`/products/products/${id}/`);
          const product = productResponse.data;
          setForm({
            category_id: String(product.category?.id || ""),
            name: product.name || "",
            slug: product.slug || "",
            description: product.description || "",
            price: String(product.price || ""),
            stock: String(product.stock ?? 0),
            image_url: product.image_url || "",
            is_active: Boolean(product.is_active),
          });
        }
      } catch (error: any) {
        showError(error.response?.data?.detail || "Failed to load product form");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [id, isEditMode]);

  const onSubmit = async () => {
    if (
      !form.category_id ||
      !form.name.trim() ||
      !form.slug.trim() ||
      !form.price.trim()
    ) {
      showError("Category, name, slug, and price are required");
      return;
    }

    setSaving(true);

    const payload = {
      category_id: Number(form.category_id),
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim(),
      price: form.price,
      stock: Number(form.stock || 0),
      image_url: form.image_url.trim(),
      is_active: form.is_active,
    };

    try {
      if (isEditMode && id) {
        await api.patch(`/products/products/${id}/`, payload);
        showSuccess("Product updated successfully");
      } else {
        await api.post("/products/products/", payload);
        showSuccess("Product created successfully");
      }
      navigate("/admin");
    } catch (error: any) {
      const data = error.response?.data;
      showError(
        data?.detail ||
          data?.slug?.[0] ||
          data?.name?.[0] ||
          "Failed to save product",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ds-page">
      <header className="ds-page-header">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="ds-page-title">{title}</h1>
          <Link to="/admin">
            <Button variant="outline" size="sm">
              Back to Admin
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Category</label>
                    <select
                      value={form.category_id}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          category_id: event.target.value,
                        }))
                      }
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    >
                      <option value="">Select category</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Price</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.price}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          price: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">Name</label>
                    <Input
                      value={form.name}
                      onChange={(event) =>
                        setForm((current) => {
                          const nameValue = event.target.value;
                          return {
                            ...current,
                            name: nameValue,
                            slug: current.slug
                              ? current.slug
                              : toSlug(nameValue),
                          };
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">Slug</label>
                    <Input
                      value={form.slug}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          slug: toSlug(event.target.value),
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">Image URL</label>
                    <Input
                      value={form.image_url}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          image_url: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Stock</label>
                    <Input
                      type="number"
                      min={0}
                      value={form.stock}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          stock: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-end pb-2">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.is_active}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            is_active: event.target.checked,
                          }))
                        }
                      />
                      Active product
                    </label>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                      rows={5}
                      value={form.description}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Link to="/admin">
                    <Button variant="outline" disabled={saving}>
                      Cancel
                    </Button>
                  </Link>
                  <Button onClick={onSubmit} disabled={saving}>
                    {saving
                      ? "Saving..."
                      : isEditMode
                        ? "Save Changes"
                        : "Create Product"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
