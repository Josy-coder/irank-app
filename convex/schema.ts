import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  auth_sessions: defineTable({
    user_id: v.id("users"),
    session_token: v.string(),
    device_info: v.optional(v.object({
      device_id: v.optional(v.string()),
      user_agent: v.optional(v.string()),
      ip_address: v.optional(v.string()),
      platform: v.optional(v.string()),
    })),
    expires_at: v.number(),
    last_used_at: v.number(),
    is_offline_capable: v.boolean(),
    created_at: v.number(),
  })
    .index("by_user_id", ["user_id"])
    .index("by_session_token", ["session_token"])
    .index("by_expires_at", ["expires_at"])
    .index("by_user_id_device_id", ["user_id", "device_info.device_id"]),

  magic_links: defineTable({
    email: v.string(),
    token: v.string(),
    user_id: v.optional(v.id("users")),
    expires_at: v.number(),
    used_at: v.optional(v.number()),
    created_at: v.number(),
    purpose: v.union(
      v.literal("login"),
      v.literal("password_reset"),
      v.literal("email_verification"),
      v.literal("account_recovery")
    ),
  })
    .index("by_email", ["email"])
    .index("by_token", ["token"])
    .index("by_expires_at", ["expires_at"])
    .index("by_email_purpose", ["email", "purpose"]),

  security_questions: defineTable({
    user_id: v.id("users"),
    question: v.string(),
    answer_hash: v.string(),
    created_at: v.number(),
    updated_at: v.optional(v.number()),
  })
    .index("by_user_id", ["user_id"]),

  password_reset_tokens: defineTable({
    user_id: v.id("users"),
    token: v.string(),
    expires_at: v.number(),
    used_at: v.optional(v.number()),
    created_at: v.number(),
  })
    .index("by_user_id", ["user_id"])
    .index("by_token", ["token"])
    .index("by_expires_at", ["expires_at"]),

  users: defineTable({
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    password_hash: v.string(),
    password_salt: v.string(),
    role: v.union(
      v.literal("student"),
      v.literal("school_admin"),
      v.literal("volunteer"),
      v.literal("admin")
    ),
    profile_image: v.optional(v.id("_storage")),
    school_id: v.optional(v.id("schools")),
    status: v.union(
      v.literal("active"),
      v.literal("inactive"),
      v.literal("banned")
    ),
    verified: v.boolean(),
    gender: v.optional(v.union(
      v.literal("male"),
      v.literal("female"),
      v.literal("non_binary")
    )),
    date_of_birth: v.optional(v.string()),

    // Student-specific fields
    grade: v.optional(v.string()),

    // School admin specific fields
    position: v.optional(v.string()),

    // Volunteer-specific fields
    high_school_attended: v.optional(v.string()),
    safeguarding_certificate: v.optional(v.id("_storage")),
    national_id: v.optional(v.string()),

    mfa_enabled: v.optional(v.boolean()),
    biometric_enabled: v.optional(v.boolean()),
    last_login_at: v.optional(v.number()),
    password_changed_at: v.optional(v.number()),
    failed_login_attempts: v.optional(v.number()),
    locked_until: v.optional(v.number()),
    created_at: v.number(),
    updated_at: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_phone", ["phone"])
    .index("by_school_id", ["school_id"])
    .index("by_role", ["role"])
    .index("by_status", ["status"])
    .index("by_verified", ["verified"])
    .index("by_role_status", ["role", "status"])
    .index("by_school_id_role", ["school_id", "role"])
    .index("by_name", ["name"])
    .index("by_email_role", ["email", "role"])
    .searchIndex("search_users", {
      searchField: "name",
      filterFields: ["role", "status", "school_id", "verified"]
    }),

  schools: defineTable({
    name: v.string(),
    type: v.union(
      v.literal("Private"),
      v.literal("Public"),
      v.literal("Government Aided"),
      v.literal("International")
    ),
    country: v.string(),
    province: v.optional(v.string()),
    district: v.optional(v.string()),
    sector: v.optional(v.string()),
    cell: v.optional(v.string()),
    village: v.optional(v.string()),
    contact_name: v.string(),
    contact_email: v.string(),
    contact_phone: v.optional(v.string()),
    logo_url: v.optional(v.id("_storage")),
    status: v.union(
      v.literal("active"),
      v.literal("inactive"),
      v.literal("banned")
    ),
    verified: v.boolean(),
    created_by: v.optional(v.id("users")),
    created_at: v.number(),
    updated_at: v.optional(v.number()),
  })
    .index("by_name", ["name"])
    .index("by_country", ["country"])
    .index("by_country_province", ["country", "province"])
    .index("by_country_province_district", ["country", "province", "district"])
    .index("by_status", ["status"])
    .index("by_verified", ["verified"])
    .index("by_type_status", ["type", "status"])
    .index("by_created_by", ["created_by"])
    .searchIndex("search_schools", {
      searchField: "name",
      filterFields: ["country", "type", "status", "verified"]
    }),

  leagues: defineTable({
    name: v.string(),
    type: v.union(
      v.literal("Local"),
      v.literal("International"),
      v.literal("Dreams Mode")
    ),
    description: v.optional(v.string()),
    geographic_scope: v.optional(
      v.record(
        v.string(),
        v.object({
          provinces: v.optional(v.array(v.string())),
          districts: v.optional(v.array(v.string())),
          sectors: v.optional(v.array(v.string())),
          cells: v.optional(v.array(v.string())),
          villages: v.optional(v.array(v.string())),
        })
      )
    ),
    created_by: v.optional(v.id("users")),
    status: v.union(
      v.literal("active"),
      v.literal("inactive"),
      v.literal("banned")
    ),
    created_at: v.number(),
    updated_at: v.optional(v.number()),
  })
    .index("by_name", ["name"])
    .index("by_type", ["type"])
    .index("by_created_by", ["created_by"])
    .index("by_status", ["status"])
    .searchIndex("search_leagues", {
      searchField: "name",
      filterFields: ["type", "status"]
    }),

  tournaments: defineTable({
    name: v.string(),
    slug: v.string(),
    start_date: v.number(),
    end_date: v.number(),
    location: v.optional(v.string()),
    is_virtual: v.boolean(),
    league_id: v.optional(v.id("leagues")),
    format: v.union(
      v.literal("WorldSchools"),
      v.literal("BritishParliamentary"),
      v.literal("PublicForum"),
      v.literal("LincolnDouglas"),
      v.literal("OxfordStyle")
    ),
    coordinator_id: v.optional(v.id("users")),
    prelim_rounds: v.number(),
    elimination_rounds: v.number(),
    judges_per_debate: v.number(),
    team_size: v.number(),
    speaking_times: v.record(v.string(), v.number()),
    fee: v.optional(v.number()),
    fee_currency: v.optional(v.union(v.literal("RWF"), v.literal("USD"))),
    description: v.optional(v.string()),
    image: v.optional(v.id("_storage")),
    status: v.union(
      v.literal("draft"),
      v.literal("published"),
      v.literal("inProgress"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    created_at: v.number(),
    updated_at: v.optional(v.number()),
  })
    .index("by_name", ["name"])
    .index("by_league_id", ["league_id"])
    .index("by_coordinator_id", ["coordinator_id"])
    .index("by_status", ["status"])
    .index("by_start_date", ["start_date"])
    .index("by_status_start_date", ["status", "start_date"])
    .index("by_league_id_status", ["league_id", "status"])
    .index("by_coordinator_id_status", ["coordinator_id", "status"])
    .index("by_slug", ["slug"])
    .searchIndex("search_tournaments", {
      searchField: "name",
      filterFields: ["league_id", "format", "status", "is_virtual"]
    }),

  teams: defineTable({
    name: v.string(),
    tournament_id: v.id("tournaments"),
    school_id: v.optional(v.id("schools")),
    members: v.array(v.id("users")),
    is_confirmed: v.boolean(),
    payment_status: v.union(
      v.literal("pending"),
      v.literal("paid"),
      v.literal("waived")
    ),
    invitation_code: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("withdrawn"),
      v.literal("disqualified")
    ),
    created_at: v.number(),
    updated_at: v.optional(v.number()),
  })
    .index("by_tournament_id", ["tournament_id"])
    .index("by_school_id", ["school_id"])
    .index("by_tournament_id_school_id", ["tournament_id", "school_id"])
    .index("by_invitation_code", ["invitation_code"])
    .index("by_status", ["status"])
    .index("by_tournament_id_status", ["tournament_id", "status"])
    .searchIndex("search_teams", {
      searchField: "name",
      filterFields: ["tournament_id", "school_id", "status"]
    }),

  tournament_invitations: defineTable({
    tournament_id: v.id("tournaments"),
    target_type: v.union(
      v.literal("school"),
      v.literal("volunteer"),
      v.literal("student")
    ),
    target_id: v.id("users"),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("declined")
    ),
    invited_by: v.id("users"),
    responded_by: v.optional(v.id("users")),
    invited_at: v.number(),
    responded_at: v.optional(v.number()),
    expires_at: v.optional(v.number()),
  })
    .index("by_tournament_id", ["tournament_id"])
    .index("by_target_type_target_id", ["target_type", "target_id"])
    .index("by_tournament_id_target_type_target_id", ["tournament_id", "target_type", "target_id"])
    .index("by_status", ["status"])
    .index("by_expires_at", ["expires_at"])
    .index("by_status_expires_at", ["status", "expires_at"]),

  rounds: defineTable({
    tournament_id: v.id("tournaments"),
    round_number: v.number(),
    type: v.union(
      v.literal("preliminary"),
      v.literal("elimination"),
      v.literal("final")
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("inProgress"),
      v.literal("completed")
    ),
    start_time: v.number(),
    end_time: v.number(),
    motion: v.string(),
    is_impromptu: v.boolean(),
    motion_released_at: v.optional(v.number()),
  })
    .index("by_tournament_id", ["tournament_id"])
    .index("by_tournament_id_round_number", ["tournament_id", "round_number"])
    .index("by_status", ["status"])
    .index("by_tournament_id_status", ["tournament_id", "status"]),

  debates: defineTable({
    round_id: v.id("rounds"),
    tournament_id: v.id("tournaments"),
    room_name: v.optional(v.string()),
    virtual_meeting_url: v.optional(v.string()),
    proposition_team_id: v.optional(v.id("teams")),
    opposition_team_id: v.optional(v.id("teams")),
    judges: v.array(v.id("users")),
    head_judge_id: v.optional(v.id("users")),
    status: v.union(
      v.literal("pending"),
      v.literal("inProgress"),
      v.literal("completed"),
      v.literal("noShow")
    ),
    is_public_speaking: v.boolean(),
    start_time: v.optional(v.number()),
    end_time: v.optional(v.number()),
    current_speaker: v.optional(v.id("users")),
    current_position: v.optional(v.string()),
    time_remaining: v.optional(v.number()),
    poi_count: v.number(),
    recording: v.optional(v.id("_storage")),
    recording_duration: v.optional(v.number()),
    transcript: v.optional(v.string()),
    winning_team_id: v.optional(v.id("teams")),
    winning_team_position: v.optional(v.union(
      v.literal("proposition"),
      v.literal("opposition")
    )),
    argument_flow: v.optional(v.array(v.object({
      type: v.union(
        v.literal("main"),
        v.literal("rebuttal"),
        v.literal("poi")
      ),
      content: v.string(),
      speaker: v.id("users"),
      team: v.id("teams"),
      timestamp: v.number(),
      rebutted_by: v.optional(v.array(v.string())),
      strength: v.optional(v.number())
    }))),
    fact_checks: v.optional(v.array(v.object({
      claim: v.string(),
      result: v.union(
        v.literal("true"),
        v.literal("false"),
        v.literal("partially_true"),
        v.literal("inconclusive")
      ),
      sources: v.optional(v.array(v.string())),
      checked_by: v.id("users"),
      timestamp: v.number(),
      explanation: v.optional(v.string())
    }))),
    head_judge_notes: v.optional(v.string()),
    shared_notes: v.optional(v.array(v.object({
      content: v.string(),
      author: v.id("users"),
      timestamp: v.number(),
      visibility: v.union(
        v.literal("private"),
        v.literal("judges"),
        v.literal("all")
      )
    }))),
  })
    .index("by_round_id", ["round_id"])
    .index("by_tournament_id", ["tournament_id"])
    .index("by_proposition_team_id", ["proposition_team_id"])
    .index("by_opposition_team_id", ["opposition_team_id"])
    .index("by_head_judge_id", ["head_judge_id"])
    .index("by_status", ["status"])
    .index("by_round_id_status", ["round_id", "status"])
    .index("by_tournament_id_status", ["tournament_id", "status"]),

  judging_scores: defineTable({
    debate_id: v.id("debates"),
    judge_id: v.id("users"),
    winning_team_id: v.id("teams"),
    winning_position: v.union(
      v.literal("proposition"),
      v.literal("opposition")
    ),
    speaker_scores: v.array(v.object({
      speaker_id: v.id("users"),
      team_id: v.id("teams"),
      position: v.string(),
      score: v.number(),
      comments: v.optional(v.string()),
      clarity: v.optional(v.number()),
      fairness: v.optional(v.number()),
      knowledge: v.optional(v.number()),
      helpfulness: v.optional(v.number()),
      bias_detected: v.optional(v.boolean()),
      bias_explanation: v.optional(v.string())
    })),
    notes: v.optional(v.string()),
    submitted_at: v.number(),
    feedback_submitted: v.optional(v.boolean())
  })
    .index("by_debate_id", ["debate_id"])
    .index("by_judge_id", ["judge_id"])
    .index("by_debate_id_judge_id", ["debate_id", "judge_id"])
    .index("by_submitted_at", ["submitted_at"]),

  tournament_results: defineTable({
    tournament_id: v.id("tournaments"),
    result_type: v.union(
      v.literal("team"),
      v.literal("speaker")
    ),
    team_id: v.optional(v.id("teams")),
    wins: v.optional(v.number()),
    losses: v.optional(v.number()),
    team_points: v.optional(v.number()),
    team_rank: v.optional(v.number()),
    is_eliminated: v.optional(v.boolean()),
    eliminated_in_round: v.optional(v.number()),
    speaker_id: v.optional(v.id("users")),
    speaker_team_id: v.optional(v.id("teams")),
    total_speaker_points: v.optional(v.number()),
    average_speaker_score: v.optional(v.number()),
    speaker_rank: v.optional(v.number()),
  })
    .index("by_tournament_id", ["tournament_id"])
    .index("by_tournament_id_result_type", ["tournament_id", "result_type"])
    .index("by_team_id", ["team_id"])
    .index("by_tournament_id_team_id", ["tournament_id", "team_id"])
    .index("by_speaker_id", ["speaker_id"])
    .index("by_tournament_id_speaker_id", ["tournament_id", "speaker_id"]),

  notifications: defineTable({
    user_id: v.id("users"),
    title: v.string(),
    message: v.string(),
    type: v.union(
      v.literal("tournament"),
      v.literal("debate"),
      v.literal("result"),
      v.literal("system"),
      v.literal("auth")
    ),
    related_id: v.optional(v.string()),
    is_read: v.boolean(),
    expires_at: v.number(),
    sent_via_email: v.optional(v.boolean()),
    sent_via_push: v.optional(v.boolean()),
    sent_via_sms: v.optional(v.boolean()),
    created_at: v.number(),
  })
    .index("by_user_id", ["user_id"])
    .index("by_user_id_is_read", ["user_id", "is_read"])
    .index("by_user_id_type", ["user_id", "type"])
    .index("by_expires_at", ["expires_at"])
    .index("by_user_id_expires_at", ["user_id", "expires_at"]),

  report_shares: defineTable({
    report_type: v.union(
      v.literal("tournament"),
      v.literal("debate"),
      v.literal("team"),
      v.literal("speaker")
    ),
    report_id: v.string(),
    access_token: v.string(),
    created_by: v.id("users"),
    expires_at: v.number(),
    allowed_views: v.optional(v.number()),
    view_count: v.number(),
    created_at: v.number(),
  })
    .index("by_report_type", ["report_type"])
    .index("by_report_type_report_id", ["report_type", "report_id"])
    .index("by_access_token", ["access_token"])
    .index("by_expires_at", ["expires_at"])
    .index("by_created_by_report_type", ["created_by", "report_type"]),

  sync_logs: defineTable({
    user_id: v.id("users"),
    device_id: v.string(),
    table_name: v.string(),
    record_id: v.string(),
    operation: v.union(
      v.literal("create"),
      v.literal("update"),
      v.literal("delete")
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("conflict")
    ),
    local_timestamp: v.number(),
    server_timestamp: v.optional(v.number()),
    conflict_resolution: v.optional(v.union(
      v.literal("server"),
      v.literal("client"),
      v.literal("manual")
    )),
    conflict_data: v.optional(v.object({})),
  })
    .index("by_user_id_device_id", ["user_id", "device_id"])
    .index("by_table_name_record_id", ["table_name", "record_id"])
    .index("by_status", ["status"])
    .index("by_user_id", ["user_id"])
    .index("by_user_id_status", ["user_id", "status"])
    .index("by_user_id_device_id_status", ["user_id", "device_id", "status"]),

  judge_feedback: defineTable({
    judge_id: v.id("users"),
    debate_id: v.id("debates"),
    team_id: v.id("teams"),
    tournament_id: v.id("tournaments"),
    clarity: v.number(),
    fairness: v.number(),
    knowledge: v.number(),
    helpfulness: v.number(),
    comments: v.optional(v.string()),
    bias_detected: v.optional(v.boolean()),
    bias_explanation: v.optional(v.string()),
    submitted_at: v.number(),
    is_anonymous: v.boolean(),
  })
    .index("by_judge_id", ["judge_id"])
    .index("by_debate_id", ["debate_id"])
    .index("by_team_id", ["team_id"])
    .index("by_tournament_id", ["tournament_id"]),

  audit_logs: defineTable({
    user_id: v.id("users"),
    action: v.union(
      v.literal("user_created"),
      v.literal("user_updated"),
      v.literal("user_deleted"),
      v.literal("user_login"),
      v.literal("user_logout"),
      v.literal("user_password_changed"),
      v.literal("user_locked"),
      v.literal("user_verified"),
      v.literal("school_created"),
      v.literal("school_updated"),
      v.literal("school_deleted"),
      v.literal("league_created"),
      v.literal("league_updated"),
      v.literal("league_deleted"),
      v.literal("tournament_created"),
      v.literal("tournament_updated"),
      v.literal("tournament_deleted"),
      v.literal("tournament_published"),
      v.literal("team_created"),
      v.literal("team_updated"),
      v.literal("team_deleted"),
      v.literal("debate_created"),
      v.literal("debate_updated"),
      v.literal("debate_deleted"),
      v.literal("ballot_submitted"),
      v.literal("payment_processed"),
      v.literal("system_setting_changed")
    ),
    resource_type: v.string(),
    resource_id: v.string(),
    description: v.string(),
    previous_state: v.optional(v.string()),
    new_state: v.optional(v.string()),
    ip_address: v.optional(v.string()),
    user_agent: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_user_id", ["user_id"])
    .index("by_action", ["action"])
    .index("by_resource", ["resource_type", "resource_id"])
    .index("by_timestamp", ["timestamp"])
    .searchIndex("search_audit_logs", {
      searchField: "description",
      filterFields: ["user_id", "action", "resource_type", "timestamp"]
    }),

  payments: defineTable({
    tournament_id: v.id("tournaments"),
    school_id: v.id("schools"),
    amount: v.number(),
    currency: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("refunded")
    ),
    method: v.union(
      v.literal("bank_transfer"),
      v.literal("mobile_money"),
      v.literal("cash"),
      v.literal("other")
    ),
    reference_number: v.optional(v.string()),
    receipt_image: v.optional(v.id("_storage")),
    notes: v.optional(v.string()),
    created_by: v.id("users"),
    created_at: v.number(),
    updated_at: v.optional(v.number()),
  })
    .index("by_tournament_id", ["tournament_id", "status"])
    .index("by_school_id", ["school_id", "status"])
    .index("by_created_at", ["created_at"]),
});