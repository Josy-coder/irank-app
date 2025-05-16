import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";

/**
 * Record a sync operation in the sync logs
 * For tracking operations that need to be synchronized when online
 */
export const recordSyncOperation = mutation({
  args: {
    device_id: v.string(),
    table_name: v.string(),
    record_id: v.string(),
    operation: v.union(
      v.literal("create"),
      v.literal("update"),
      v.literal("delete")
    ),
    local_timestamp: v.number(),
    conflict_data: v.optional(v.object({})),
  },
  handler: async (ctx, args) => {
    // Check if user is authenticated
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Find the user
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Create a sync log entry
    const syncLogId = await ctx.db.insert("sync_logs", {
      user_id: user._id,
      device_id: args.device_id,
      table_name: args.table_name,
      record_id: args.record_id,
      operation: args.operation,
      status: "pending",
      local_timestamp: args.local_timestamp,
      server_timestamp: Date.now(),
      conflict_data: args.conflict_data,
    });

    return syncLogId;
  },
});

/**
 * Get pending sync operations for a device
 * Used by client to determine what operations need to be synchronized
 */
export const getPendingSyncOperations = query({
  args: {
    device_id: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if user is authenticated
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Find the user
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Get all pending sync operations for this user and device
    const pendingOperations = await ctx.db
      .query("sync_logs")
      .withIndex("by_user_id_device_id_status", (q) =>
        q.eq("user_id", user._id)
          .eq("device_id", args.device_id)
          .eq("status", "pending")
      )
      .collect();

    return pendingOperations;
  },
});

/**
 * Update sync operation status
 * Used to mark operations as completed or failed
 */
export const updateSyncOperationStatus = mutation({
  args: {
    sync_log_id: v.id("sync_logs"),
    status: v.union(
      v.literal("completed"),
      v.literal("failed"),
      v.literal("conflict")
    ),
    conflict_resolution: v.optional(v.union(
      v.literal("server"),
      v.literal("client"),
      v.literal("manual")
    )),
    conflict_data: v.optional(v.object({})),
  },
  handler: async (ctx, args) => {
    // Check if user is authenticated
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Find the user
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Get the sync log entry
    const syncLog = await ctx.db.get(args.sync_log_id);
    if (!syncLog) {
      throw new Error("Sync log not found");
    }

    // Check if the sync log belongs to the user
    if (syncLog.user_id !== user._id) {
      throw new Error("Unauthorized - This sync log does not belong to you");
    }

    // Update the sync log
    const updateData: any = {
      status: args.status,
    };

    if (args.conflict_resolution) {
      updateData.conflict_resolution = args.conflict_resolution;
    }

    if (args.conflict_data) {
      updateData.conflict_data = args.conflict_data;
    }

    return await ctx.db.patch(args.sync_log_id, updateData);
  },
});

/**
 * Batch process pending sync operations
 * This is used to efficiently handle multiple sync operations at once
 */
export const batchProcessSyncOperations = mutation({
  args: {
    device_id: v.string(),
    operations: v.array(
      v.object({
        sync_log_id: v.id("sync_logs"),
        status: v.union(
          v.literal("completed"),
          v.literal("failed"),
          v.literal("conflict")
        ),
        conflict_resolution: v.optional(v.union(
          v.literal("server"),
          v.literal("client"),
          v.literal("manual")
        )),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Check if user is authenticated
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Find the user
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Process each operation
    const results = [];
    for (const operation of args.operations) {
      // Get the sync log entry
      const syncLog = await ctx.db.get(operation.sync_log_id);
      if (!syncLog) {
        results.push({
          sync_log_id: operation.sync_log_id,
          success: false,
          message: "Sync log not found",
        });
        continue;
      }

      // Check if the sync log belongs to the user and device
      if (syncLog.user_id !== user._id || syncLog.device_id !== args.device_id) {
        results.push({
          sync_log_id: operation.sync_log_id,
          success: false,
          message: "Unauthorized - This sync log does not belong to you or this device",
        });
        continue;
      }

      // Update the sync log
      const updateData: any = {
        status: operation.status,
      };

      if (operation.conflict_resolution) {
        updateData.conflict_resolution = operation.conflict_resolution;
      }

      try {
        await ctx.db.patch(operation.sync_log_id, updateData);
        results.push({
          sync_log_id: operation.sync_log_id,
          success: true,
        });
      } catch (error: any) {
        results.push({
          sync_log_id: operation.sync_log_id,
          success: false,
          message: error.message,
        });
      }
    }

    return results;
  },
});

/**
 * Get sync statistics
 * Provides information about sync status across all devices for a user
 */
export const getSyncStats = query({
  args: {},
  handler: async (ctx) => {
    // Check if user is authenticated
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Find the user
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Get all sync logs for this user
    const allSyncLogs = await ctx.db
      .query("sync_logs")
      .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
      .collect();

    // Calculate statistics
    const stats = {
      total: allSyncLogs.length,
      pending: allSyncLogs.filter(log => log.status === "pending").length,
      completed: allSyncLogs.filter(log => log.status === "completed").length,
      failed: allSyncLogs.filter(log => log.status === "failed").length,
      conflicts: allSyncLogs.filter(log => log.status === "conflict").length,
      byDevice: {} as Record<string, {
        total: number;
        pending: number;
        completed: number;
        failed: number;
        conflicts: number;
      }>,
    };

    // Group by device
    allSyncLogs.forEach(log => {
      if (!stats.byDevice[log.device_id]) {
        stats.byDevice[log.device_id] = {
          total: 0,
          pending: 0,
          completed: 0,
          failed: 0,
          conflicts: 0,
        };
      }

      stats.byDevice[log.device_id].total++;

      if (log.status === "pending") {
        stats.byDevice[log.device_id].pending++;
      } else if (log.status === "completed") {
        stats.byDevice[log.device_id].completed++;
      } else if (log.status === "failed") {
        stats.byDevice[log.device_id].failed++;
      } else if (log.status === "conflict") {
        stats.byDevice[log.device_id].conflicts++;
      }
    });

    return stats;
  },
});