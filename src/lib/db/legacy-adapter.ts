/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Normalizes Prisma-style where clauses, flattening compound unique constraint objects
 * (e.g. { user_id_tenant_id: { user_id, tenant_id } } => { user_id, tenant_id })
 * so that Prisma 8 / orm-postgres queries execute properly without shorthand filter errors.
 */
export function normalizeWhere(where: any): any {
  if (!where || typeof where !== "object") return where;
  const result: any = {};
  for (const [key, val] of Object.entries(where)) {
    if (
      val &&
      typeof val === "object" &&
      !Array.isArray(val) &&
      !(val instanceof Date)
    ) {
      const innerKeys = Object.keys(val);
      const isOperator = innerKeys.every((k) =>
        [
          "in",
          "notIn",
          "not",
          "lt",
          "lte",
          "gt",
          "gte",
          "contains",
          "startsWith",
          "endsWith",
          "mode",
          "equals",
        ].includes(k)
      );
      if (!isOperator && innerKeys.length > 0) {
        // Flatten compound unique object
        Object.assign(result, normalizeWhere(val));
        continue;
      }
    }
    result[key] = val;
  }
  return result;
}

export function adaptPrisma7(ormCollection: any): any {
  if (!ormCollection) return undefined;

  return {
    findUnique: async (args: any) => {
      const normalizedWhere = normalizeWhere(args?.where);
      let q = ormCollection.where(normalizedWhere);
      if (args?.include) q = applyIncludes(q, args.include);
      if (args?.select) q = applySelect(q, args.select);
      return q.first();
    },
    findUniqueOrThrow: async (args: any) => {
      const normalizedWhere = normalizeWhere(args?.where);
      let q = ormCollection.where(normalizedWhere);
      if (args?.include) q = applyIncludes(q, args.include);
      if (args?.select) q = applySelect(q, args.select);
      const res = await q.first();
      if (!res) throw new Error("Record not found");
      return res;
    },
    findFirst: async (args: any) => {
      const normalizedWhere = normalizeWhere(args?.where);
      let q = normalizedWhere ? ormCollection.where(normalizedWhere) : ormCollection;
      if (args?.include) q = applyIncludes(q, args.include);
      if (args?.select) q = applySelect(q, args.select);
      if (args?.orderBy) q = applyOrderBy(q, args.orderBy);
      if (typeof args?.skip === "number" && typeof q.offset === "function") q = q.offset(args.skip);
      return q.first();
    },
    findFirstOrThrow: async (args: any) => {
      const normalizedWhere = normalizeWhere(args?.where);
      let q = normalizedWhere ? ormCollection.where(normalizedWhere) : ormCollection;
      if (args?.include) q = applyIncludes(q, args.include);
      if (args?.select) q = applySelect(q, args.select);
      if (args?.orderBy) q = applyOrderBy(q, args.orderBy);
      if (typeof args?.skip === "number" && typeof q.offset === "function") q = q.offset(args.skip);
      const res = await q.first();
      if (!res) throw new Error("Record not found");
      return res;
    },
    findMany: async (args: any) => {
      const normalizedWhere = normalizeWhere(args?.where);
      let q = normalizedWhere ? ormCollection.where(normalizedWhere) : ormCollection;
      if (args?.include) q = applyIncludes(q, args.include);
      if (args?.select) q = applySelect(q, args.select);
      if (args?.orderBy) q = applyOrderBy(q, args.orderBy);
      if (typeof args?.skip === "number" && typeof q.offset === "function") q = q.offset(args.skip);
      if (typeof args?.take === "number" && typeof q.limit === "function") q = q.limit(args.take);
      return q.all();
    },
    count: async (args: any) => {
      const normalizedWhere = normalizeWhere(args?.where);
      const q = normalizedWhere ? ormCollection.where(normalizedWhere) : ormCollection;
      const agg = q.aggregate((f: any) => ({ _count: f.count() }));
      const res = typeof agg?.first === "function" ? await agg.first() : await agg;
      return res ? (res._count ?? res.count ?? 0) : 0;
    },
    create: async (args: any) => {
      return ormCollection.create(args.data);
    },
    createMany: async (args: any) => {
      const dataArray = Array.isArray(args.data) ? args.data : [args.data];
      // Prisma 8 has createAll
      return ormCollection.createAll(dataArray);
    },
    update: async (args: any) => {
      const normalizedWhere = normalizeWhere(args?.where);
      return ormCollection.where(normalizedWhere).update(args.data);
    },
    updateMany: async (args: any) => {
      const normalizedWhere = normalizeWhere(args?.where);
      const res = await ormCollection.where(normalizedWhere).updateAll(args.data);
      return { count: Array.isArray(res) ? res.length : (res?.count ?? 0) };
    },
    delete: async (args: any) => {
      const normalizedWhere = normalizeWhere(args?.where);
      return ormCollection.where(normalizedWhere).delete();
    },
    deleteMany: async (args: any) => {
      const normalizedWhere = normalizeWhere(args?.where);
      const res = await ormCollection.where(normalizedWhere).deleteAll();
      return { count: Array.isArray(res) ? res.length : (res?.count ?? 0) };
    },
    upsert: async (args: any) => {
      const normalizedWhere = normalizeWhere(args?.where);
      let conflictOn = args?.conflictOn;
      if (!conflictOn && normalizedWhere && Object.keys(normalizedWhere).length > 0) {
        conflictOn = Object.fromEntries(Object.keys(normalizedWhere).map((k) => [k, true]));
      } else if (Array.isArray(conflictOn)) {
        conflictOn = Object.fromEntries(conflictOn.map((k) => [k, true]));
      }
      return ormCollection.upsert({
        create: args.create,
        update: args.update,
        conflictOn: conflictOn,
      });
    },
    aggregate: async (args: any) => {
      if (args._sum) {
        const normalizedWhere = normalizeWhere(args?.where);
        const q = normalizedWhere ? ormCollection.where(normalizedWhere) : ormCollection;
        const sums = Object.keys(args._sum);
        if (sums.length > 0) {
          const res = await q
            .aggregate((f: any) => {
              const obj: any = {};
              for (const sumField of sums) {
                obj[sumField] = f.sum(sumField);
              }
              return obj;
            })
            .first();
          return { _sum: res };
        }
      }
      throw new Error("Aggregate not fully implemented in legacy adapter");
    },
    groupBy: async (args: any) => {
      if (args.by && args._sum) {
        const normalizedWhere = normalizeWhere(args?.where);
        let q = normalizedWhere ? ormCollection.where(normalizedWhere) : ormCollection;
        q = q.groupBy(...args.by);
        const sums = Object.keys(args._sum);
        const aggRes = await q
          .aggregate((f: any) => {
            const obj: any = {};
            for (const b of args.by) obj[b] = f.key(b);
            for (const sumField of sums) obj[`_sum_${sumField}`] = f.sum(sumField);
            return obj;
          })
          .all();

        return aggRes.map((r: any) => {
          const out: any = { _sum: {} };
          for (const b of args.by) out[b] = r[b];
          for (const sumField of sums) out._sum[sumField] = r[`_sum_${sumField}`];
          return out;
        });
      }
      throw new Error("GroupBy not fully implemented in legacy adapter");
    },
  };
}

function applyIncludes(q: any, include: any): any {
  for (const [key, val] of Object.entries(include)) {
    if (val === true) {
      q = q.include(key);
    } else if (typeof val === "object" && val !== null) {
      q = q.include(key, (child: any) => {
        let cq = child;
        if ((val as any).include) cq = applyIncludes(cq, (val as any).include);
        if ((val as any).where) cq = cq.where(normalizeWhere((val as any).where));
        return cq;
      });
    }
  }
  return q;
}

function applySelect(q: any, select: any): any {
  if (!select || typeof select !== "object") return q;
  const entries = Object.entries(select);
  if (entries.length === 0) {
    throw new Error("The `select` option cannot be an empty object.");
  }

  const scalarFields: string[] = [];
  const relationFields: Record<string, any> = {};

  for (const [key, val] of entries) {
    if (val === true) {
      scalarFields.push(key);
    } else if (val && typeof val === "object") {
      relationFields[key] = val;
    }
  }

  if (scalarFields.length === 0 && Object.keys(relationFields).length === 0) {
    throw new Error("The `select` option must contain at least one field or relation selection.");
  }

  if (typeof q.select === "function" && scalarFields.length > 0) {
    q = q.select(...scalarFields);
  }

  if (Object.keys(relationFields).length > 0) {
    q = applyIncludes(q, relationFields);
  }

  return q;
}

function applyOrderBy(q: any, orderBy: any): any {
  if (!orderBy || typeof q.orderBy !== "function") return q;
  const orders = Array.isArray(orderBy) ? orderBy : [orderBy];
  for (const order of orders) {
    if (!order || typeof order !== "object") continue;
    for (const [col, dir] of Object.entries(order)) {
      if (typeof dir === "string") {
        const isDesc = dir.toLowerCase() === "desc";
        q = q.orderBy((m: any) => (isDesc ? m[col]?.desc() : m[col]?.asc()));
      }
    }
  }
  return q;
}

export function getModel(client: any, modelName: string): any {
  if (!client) return undefined;
  const rawModel = client.orm?.public?.[modelName] ||
                   client.orm?.public?.[modelName.charAt(0).toUpperCase() + modelName.slice(1)] ||
                   client[modelName] ||
                   client[modelName.charAt(0).toLowerCase() + modelName.slice(1)];
  if (!rawModel) return undefined;
  if ((typeof rawModel.findUnique === "function" || typeof rawModel.findMany === "function") && typeof rawModel.where !== "function") {
    return rawModel;
  }
  return adaptPrisma7(rawModel);
}

/**
 * Executes an operation inside a database transaction, supporting Prisma 8 (db.transaction),
 * Prisma 7/client (db.$transaction), and mock clients in test suites.
 *
 * Fail-closed: If the database client does not support transactions, throws SERVICE_UNAVAILABLE.
 * Never silently executes mutations outside a real transaction.
 */
export async function runTransaction<T = any>(
  client: any,
  action: (tx: any) => Promise<T>
): Promise<T> {
  if (!client) {
    throw new Error("SERVICE_UNAVAILABLE: Database client is unavailable");
  }

  const runner = typeof client.transaction === "function"
    ? client.transaction.bind(client)
    : typeof client.$transaction === "function"
    ? client.$transaction.bind(client)
    : null;

  if (!runner) {
    throw new Error("SERVICE_UNAVAILABLE: Database transaction support is unavailable");
  }

  return await runner(action);
}
