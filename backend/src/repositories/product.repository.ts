import { query } from "../config/db.js";
import { Product } from "../models/domain.js";

function mapRow(row: Record<string, unknown>): Product {
  return {
    id: String(row.id),
    name: String(row.name),
    sku: String(row.sku),
    price: Number(row.price),
    description: String(row.description || ""),
    quantity: Number(row.quantity),
    imageUrl: row.image_url ? String(row.image_url) : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export class ProductRepository {
  async list(): Promise<Product[]> {
    const result = await query("SELECT * FROM products ORDER BY name");
    return result.rows.map(mapRow);
  }

  async findById(id: string): Promise<Product | null> {
    const result = await query("SELECT * FROM products WHERE id = $1", [id]);
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  async findBySku(sku: string): Promise<Product | null> {
    const result = await query("SELECT * FROM products WHERE sku = $1", [sku]);
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  async create(input: {
    name: string;
    sku: string;
    price: number;
    quantity: number;
    description?: string;
    imageUrl?: string | null;
  }): Promise<Product> {
    const result = await query(
      `INSERT INTO products (name, sku, price, quantity, description, image_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.name,
        input.sku,
        input.price,
        input.quantity,
        input.description || "",
        input.imageUrl || null,
      ]
    );
    return mapRow(result.rows[0]);
  }

  async update(
    id: string,
    input: Partial<{
      name: string;
      sku: string;
      price: number;
      quantity: number;
      description: string;
      imageUrl: string | null;
    }>
  ): Promise<Product | null> {
    const current = await this.findById(id);
    if (!current) return null;
    const result = await query(
      `UPDATE products SET
         name = $2,
         sku = $3,
         price = $4,
         quantity = $5,
         description = $6,
         image_url = $7,
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        input.name ?? current.name,
        input.sku ?? current.sku,
        input.price ?? current.price,
        input.quantity ?? current.quantity,
        input.description ?? current.description,
        input.imageUrl !== undefined ? input.imageUrl : current.imageUrl,
      ]
    );
    return mapRow(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const result = await query("DELETE FROM products WHERE id = $1", [id]);
    return (result.rowCount || 0) > 0;
  }

  async adjustQuantity(id: string, delta: number): Promise<Product | null> {
    const result = await query(
      `UPDATE products
       SET quantity = GREATEST(0, quantity + $2), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, delta]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  async countOutOfStock(): Promise<number> {
    const result = await query("SELECT COUNT(*)::int AS count FROM products WHERE quantity <= 0");
    return Number(result.rows[0]?.count || 0);
  }
}

export const productRepository = new ProductRepository();
