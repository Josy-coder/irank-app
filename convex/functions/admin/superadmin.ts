import { v } from "convex/values";
import { query } from "../../_generated/server";
import { internal } from "../../_generated/api";


export const isSuperAdmin = query({
  args: {
    token: v.string(),
    user_id: v.id("users"),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly,
      { token: args.token, }
    );

    if (!sessionResult.valid || sessionResult.user?.role !== "admin") {
      return false;
    }

    if(sessionResult.user?.id !== args.user_id) {
      return false;
    }

    const superAdminIds = process.env.SUPER_ADMIN_IDS;

    if (!superAdminIds) {
      return false;
    }

    const superAdminList = superAdminIds.split(',').map(id => id.trim());

    return superAdminList.includes(args.user_id);
  },
});