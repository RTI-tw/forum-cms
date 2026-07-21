import { list } from "@keystone-6/core";

import {
    text,
    relationship,
    password,
    select,
    checkbox,
    timestamp,
    integer,
    json,
} from "@keystone-6/core/fields";
import {
    assertPasswordStrength,
    checkPasswordHistory,
    addToPasswordHistory,
    passwordPolicy,
} from "../utils/password-policy";
import { allowRolesForUsersAdminOnly, admin } from "../utils/access-control";

const listConfigurations = list({
    fields: {
        name: text({
            label: "姓名",
            validation: { isRequired: true },
        }),
        email: text({
            label: "Email",
            validation: { isRequired: true },
            isIndexed: "unique",
            isFilterable: true,
        }),
        password: password({
            label: "密碼",
            validation: {
                isRequired: true,
                length: {
                    min: passwordPolicy.minLength,
                },
            },
        }),
        role: select({
            label: "角色權限",
            type: "string",
            options: [
                {
                    label: "Admin",
                    value: "admin",
                },
                {
                    label: "Editor",
                    value: "editor",
                },
                {
                    label: "Partner",
                    value: "partner",
                },
            ],
            validation: { isRequired: true },
        }),
        // publisher: relationship({
        //   label: 'Publisher',
        //   ref: 'Publisher.user',
        //   many: false,
        // }),
        officialAccounts: relationship({
            label: "官方帳號授權",
            ref: "OfficialMapping.cmsUser",
            many: true,
        }),
        partnerMember: relationship({
            label: "連結前台會員帳號",
            ref: "Member.partnerUser",
            many: false,
            ui: {
                description: "Partner 必須連結一個啟用中的前台會員帳號。",
            },
        }),
        isProtected: checkbox({
            label: "受保護",
            defaultValue: false,
        }),
        passwordUpdatedAt: timestamp({
            label: "上次密碼更新時間",
            defaultValue: { kind: "now" },
            ui: {
                createView: { fieldMode: "hidden" },
                itemView: { fieldMode: "read" },
                listView: { fieldMode: "read" },
            },
        }),
        mustChangePassword: checkbox({
            label: "需要強制變更密碼",
            defaultValue: false,
            ui: {
                description: "勾選後，使用者下次登入會被要求先變更密碼",
            },
        }),
        loginFailedAttempts: integer({
            label: "登入失敗次數",
            defaultValue: 0,
            ui: {
                createView: { fieldMode: "hidden" },
                itemView: { fieldMode: "read" },
                listView: { fieldMode: "read" },
            },
        }),
        accountLockedUntil: timestamp({
            label: "帳號鎖定至",
            db: { isNullable: true },
            ui: {
                createView: { fieldMode: "hidden" },
                itemView: { fieldMode: "read" },
                listView: { fieldMode: "read" },
            },
        }),
        lastFailedLoginAt: timestamp({
            label: "最後登入失敗時間",
            db: { isNullable: true },
            ui: {
                createView: { fieldMode: "hidden" },
                itemView: { fieldMode: "read" },
                listView: { fieldMode: "read" },
            },
        }),
        passwordHistory: json({
            label: "密碼歷史記錄",
            defaultValue: null,
            ui: {
                createView: { fieldMode: "hidden" },
                itemView: { fieldMode: "read" },
                listView: { fieldMode: "read" },
            },
        }),
        // posts: relationship({ ref: 'Post.author', many: true }),
    },

    ui: {
        label: "使用者",
        listView: {
            initialColumns: ["name", "role"],
        },
    },
    access: {
        operation: {
            query: allowRolesForUsersAdminOnly(),
            update: allowRolesForUsersAdminOnly(),
            create: allowRolesForUsersAdminOnly(),
            delete: allowRolesForUsersAdminOnly(),
        },
    },
    hooks: {
        resolveInput: async ({
            resolvedData,
            item,
            context,
            operation,
            inputData,
        }) => {
            const data = { ...resolvedData };

            const nextRole = data.role ?? item?.role;
            const nextPartnerMember = data.partnerMember;
            if (nextRole === "partner") {
                const connectedMemberId = (nextPartnerMember as any)?.connect?.id;
                let currentMemberId: number | null = null;
                if (item?.id) {
                    const current = await context.sudo().prisma.user.findUnique({
                        where: { id: Number(item.id) },
                        select: { partnerMember: { select: { id: true } } },
                    });
                    currentMemberId = current?.partnerMember?.id ?? null;
                }
                const currentHasMember = currentMemberId != null;
                const connectsMember = connectedMemberId != null;
                const disconnectsMember = Boolean((nextPartnerMember as any)?.disconnect);
                if ((!currentHasMember && !connectsMember) || disconnectsMember) {
                    throw new Error("Partner 必須連結前台會員帳號");
                }
                const memberId = connectedMemberId ?? currentMemberId;
                const member = memberId == null ? null : await context.sudo().prisma.member.findUnique({
                    where: { id: Number(memberId) },
                    select: { status: true, partnerUserId: true },
                });
                if (!member || member.status !== "active") {
                    throw new Error("Partner 只能連結啟用中的前台會員帳號");
                }
                if (member.partnerUserId != null && member.partnerUserId !== Number(item?.id)) {
                    throw new Error("此前台會員帳號已連結其他 Partner");
                }
            }

            // Get plain text password from inputData (before KeystoneJS hashes it)
            const plainTextPassword = inputData?.password;
            const isPasswordBeingUpdated =
                typeof plainTextPassword === "string" &&
                plainTextPassword.length > 0 &&
                !plainTextPassword.startsWith("$2a$") &&
                !plainTextPassword.startsWith("$2b$");

            if (isPasswordBeingUpdated) {
                // Validate password strength using plain text
                assertPasswordStrength(plainTextPassword);

                // Check password history for update operations
                if (operation === "update" && item?.id) {
                    try {
                        // Fetch current user data including password hash and history
                        const userId =
                            typeof item.id === "number"
                                ? item.id
                                : parseInt(String(item.id), 10);
                        const currentUser = await context
                            .sudo()
                            .db.User.findOne({
                                where: { id: userId },
                            });

                        if (currentUser) {
                            // First, check if new password matches current password
                            const bcrypt = await import("bcryptjs");
                            const currentPasswordHash = String(
                                currentUser.password
                            );
                            const matchesCurrentPassword = await bcrypt.compare(
                                plainTextPassword,
                                currentPasswordHash
                            );

                            if (matchesCurrentPassword) {
                                throw new Error(
                                    "密碼不可與前3次使用過的密碼相同"
                                );
                            }

                            // Then check password history using PLAIN TEXT password
                            const passwordHistory =
                                currentUser.passwordHistory as
                                    | string[]
                                    | null
                                    | undefined;
                            const isDuplicate = await checkPasswordHistory(
                                plainTextPassword,
                                passwordHistory
                            );

                            if (isDuplicate) {
                                throw new Error(
                                    "密碼不可與前3次使用過的密碼相同"
                                );
                            }

                            // Update history with current password hash
                            const updatedPasswordHistory = addToPasswordHistory(
                                currentPasswordHash,
                                passwordHistory
                            );
                            data.passwordHistory = updatedPasswordHistory;
                        }
                    } catch (error) {
                        // If it's our custom error, re-throw it
                        if (
                            error instanceof Error &&
                            error.message.includes(
                                "密碼不可與前3次使用過的密碼相同"
                            )
                        ) {
                            throw error;
                        }
                        // For other errors, log and continue (don't block password update)
                        console.error(
                            "Error checking password history in hook:",
                            error
                        );
                    }
                }

                data.passwordUpdatedAt = new Date().toISOString();
                data.mustChangePassword = false;
            }

            if (
                typeof data.mustChangePassword === "undefined" &&
                typeof item?.mustChangePassword !== "undefined"
            ) {
                data.mustChangePassword = item.mustChangePassword;
            }

            return data;
        },
    },
});

export default listConfigurations;
