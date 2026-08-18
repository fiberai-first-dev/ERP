import { query } from "../config/db.js";

export class CustomerRepository {
  async findById(id: string): Promise<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  } | null> {
    const result = await query(
      "SELECT id, name, email, phone, address FROM customers WHERE id = $1 LIMIT 1",
      [id]
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: String(row.id),
      name: String(row.name),
      email: row.email ? String(row.email) : null,
      phone: row.phone ? String(row.phone) : null,
      address: row.address ? String(row.address) : null,
    };
  }

  async findOrCreate(input: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  }): Promise<string> {
    if (input.email) {
      const existing = await query("SELECT id FROM customers WHERE email = $1 LIMIT 1", [input.email]);
      if (existing.rows[0]) return String(existing.rows[0].id);
    }

    const created = await query(
      `INSERT INTO customers (name, email, phone, address)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [input.name, input.email || null, input.phone || null, input.address || null]
    );
    return String(created.rows[0].id);
  }
}

export const customerRepository = new CustomerRepository();
