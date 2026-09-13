/**
 * ADALAT360 - Auth Validators
 * Zod schemas for request validation
 */
import { z } from 'zod';
import { UserRole, UserStatus } from '../types/database.js';
export declare const uuidSchema: z.ZodString;
export declare const emailSchema: z.ZodString;
export declare const phoneSchema: z.ZodOptional<z.ZodString>;
export declare const paginationSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    sort_by: z.ZodOptional<z.ZodString>;
    sort_order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    page: number;
    sort_order: "asc" | "desc";
    sort_by?: string | undefined;
}, {
    limit?: number | undefined;
    page?: number | undefined;
    sort_by?: string | undefined;
    sort_order?: "asc" | "desc" | undefined;
}>;
export declare const dateRangeSchema: z.ZodObject<{
    start_date: z.ZodOptional<z.ZodDate>;
    end_date: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    start_date?: Date | undefined;
    end_date?: Date | undefined;
}, {
    start_date?: Date | undefined;
    end_date?: Date | undefined;
}>;
export declare const loginSchema: z.ZodObject<{
    body: z.ZodObject<{
        email: z.ZodString;
        password: z.ZodString;
        totp_code: z.ZodOptional<z.ZodString>;
        backup_code: z.ZodOptional<z.ZodString>;
        remember_me: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        email: string;
        password: string;
        remember_me: boolean;
        totp_code?: string | undefined;
        backup_code?: string | undefined;
    }, {
        email: string;
        password: string;
        totp_code?: string | undefined;
        backup_code?: string | undefined;
        remember_me?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        email: string;
        password: string;
        remember_me: boolean;
        totp_code?: string | undefined;
        backup_code?: string | undefined;
    };
}, {
    body: {
        email: string;
        password: string;
        totp_code?: string | undefined;
        backup_code?: string | undefined;
        remember_me?: boolean | undefined;
    };
}>;
export declare const refreshTokenSchema: z.ZodObject<{
    body: z.ZodObject<{
        refresh_token: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        refresh_token: string;
    }, {
        refresh_token: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        refresh_token: string;
    };
}, {
    body: {
        refresh_token: string;
    };
}>;
export declare const mfaVerifySchema: z.ZodObject<{
    body: z.ZodObject<{
        code: z.ZodString;
        type: z.ZodEnum<["totp", "backup"]>;
    }, "strip", z.ZodTypeAny, {
        type: "totp" | "backup";
        code: string;
    }, {
        type: "totp" | "backup";
        code: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        type: "totp" | "backup";
        code: string;
    };
}, {
    body: {
        type: "totp" | "backup";
        code: string;
    };
}>;
export declare const changePasswordSchema: z.ZodObject<{
    body: z.ZodEffects<z.ZodObject<{
        current_password: z.ZodString;
        new_password: z.ZodString;
        confirm_password: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        current_password: string;
        new_password: string;
        confirm_password: string;
    }, {
        current_password: string;
        new_password: string;
        confirm_password: string;
    }>, {
        current_password: string;
        new_password: string;
        confirm_password: string;
    }, {
        current_password: string;
        new_password: string;
        confirm_password: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        current_password: string;
        new_password: string;
        confirm_password: string;
    };
}, {
    body: {
        current_password: string;
        new_password: string;
        confirm_password: string;
    };
}>;
export declare const forgotPasswordSchema: z.ZodObject<{
    body: z.ZodObject<{
        email: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        email: string;
    }, {
        email: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        email: string;
    };
}, {
    body: {
        email: string;
    };
}>;
export declare const resetPasswordSchema: z.ZodObject<{
    body: z.ZodEffects<z.ZodObject<{
        token: z.ZodString;
        new_password: z.ZodString;
        confirm_password: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        token: string;
        new_password: string;
        confirm_password: string;
    }, {
        token: string;
        new_password: string;
        confirm_password: string;
    }>, {
        token: string;
        new_password: string;
        confirm_password: string;
    }, {
        token: string;
        new_password: string;
        confirm_password: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        token: string;
        new_password: string;
        confirm_password: string;
    };
}, {
    body: {
        token: string;
        new_password: string;
        confirm_password: string;
    };
}>;
export declare const registerUserSchema: z.ZodObject<{
    body: z.ZodObject<{
        employee_id: z.ZodString;
        email: z.ZodString;
        phone: z.ZodOptional<z.ZodString>;
        password: z.ZodString;
        full_name: z.ZodString;
        role: z.ZodNativeEnum<typeof UserRole>;
        department: z.ZodString;
        designation: z.ZodOptional<z.ZodString>;
        badge_number: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        email: string;
        role: UserRole;
        department: string;
        password: string;
        full_name: string;
        employee_id: string;
        phone?: string | undefined;
        designation?: string | undefined;
        badge_number?: string | undefined;
    }, {
        email: string;
        role: UserRole;
        department: string;
        password: string;
        full_name: string;
        employee_id: string;
        phone?: string | undefined;
        designation?: string | undefined;
        badge_number?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        email: string;
        role: UserRole;
        department: string;
        password: string;
        full_name: string;
        employee_id: string;
        phone?: string | undefined;
        designation?: string | undefined;
        badge_number?: string | undefined;
    };
}, {
    body: {
        email: string;
        role: UserRole;
        department: string;
        password: string;
        full_name: string;
        employee_id: string;
        phone?: string | undefined;
        designation?: string | undefined;
        badge_number?: string | undefined;
    };
}>;
export declare const updateProfileSchema: z.ZodObject<{
    body: z.ZodEffects<z.ZodObject<{
        full_name: z.ZodOptional<z.ZodString>;
        phone: z.ZodOptional<z.ZodString>;
        designation: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        full_name?: string | undefined;
        phone?: string | undefined;
        designation?: string | undefined;
    }, {
        full_name?: string | undefined;
        phone?: string | undefined;
        designation?: string | undefined;
    }>, {
        full_name?: string | undefined;
        phone?: string | undefined;
        designation?: string | undefined;
    }, {
        full_name?: string | undefined;
        phone?: string | undefined;
        designation?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        full_name?: string | undefined;
        phone?: string | undefined;
        designation?: string | undefined;
    };
}, {
    body: {
        full_name?: string | undefined;
        phone?: string | undefined;
        designation?: string | undefined;
    };
}>;
export declare const setupMfaSchema: z.ZodObject<{
    body: z.ZodObject<{
        verification_code: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        verification_code: string;
    }, {
        verification_code: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        verification_code: string;
    };
}, {
    body: {
        verification_code: string;
    };
}>;
export declare const disableMfaSchema: z.ZodObject<{
    body: z.ZodObject<{
        password: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        password: string;
    }, {
        password: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        password: string;
    };
}, {
    body: {
        password: string;
    };
}>;
export declare const regenerateBackupCodesSchema: z.ZodObject<{
    body: z.ZodObject<{
        password: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        password: string;
    }, {
        password: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        password: string;
    };
}, {
    body: {
        password: string;
    };
}>;
export declare const userQuerySchema: z.ZodObject<{
    query: z.ZodObject<{
        role: z.ZodOptional<z.ZodNativeEnum<typeof UserRole>>;
        status: z.ZodOptional<z.ZodNativeEnum<typeof UserStatus>>;
        department: z.ZodOptional<z.ZodString>;
        search: z.ZodOptional<z.ZodString>;
        page: z.ZodDefault<z.ZodNumber>;
        limit: z.ZodDefault<z.ZodNumber>;
        sort_by: z.ZodOptional<z.ZodString>;
        sort_order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        page: number;
        sort_order: "asc" | "desc";
        role?: UserRole | undefined;
        department?: string | undefined;
        search?: string | undefined;
        status?: UserStatus | undefined;
        sort_by?: string | undefined;
    }, {
        role?: UserRole | undefined;
        department?: string | undefined;
        search?: string | undefined;
        status?: UserStatus | undefined;
        limit?: number | undefined;
        page?: number | undefined;
        sort_by?: string | undefined;
        sort_order?: "asc" | "desc" | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        limit: number;
        page: number;
        sort_order: "asc" | "desc";
        role?: UserRole | undefined;
        department?: string | undefined;
        search?: string | undefined;
        status?: UserStatus | undefined;
        sort_by?: string | undefined;
    };
}, {
    query: {
        role?: UserRole | undefined;
        department?: string | undefined;
        search?: string | undefined;
        status?: UserStatus | undefined;
        limit?: number | undefined;
        page?: number | undefined;
        sort_by?: string | undefined;
        sort_order?: "asc" | "desc" | undefined;
    };
}>;
export declare const auditQuerySchema: z.ZodObject<{
    query: z.ZodObject<{
        user_id: z.ZodOptional<z.ZodString>;
        event_type: z.ZodOptional<z.ZodString>;
        event_category: z.ZodOptional<z.ZodString>;
        resource_type: z.ZodOptional<z.ZodString>;
        resource_id: z.ZodOptional<z.ZodString>;
        action: z.ZodOptional<z.ZodString>;
        outcome: z.ZodOptional<z.ZodEnum<["SUCCESS", "FAILURE", "PARTIAL", "DENIED", "ERROR"]>>;
        severity: z.ZodOptional<z.ZodEnum<["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]>>;
        start_date: z.ZodOptional<z.ZodDate>;
        end_date: z.ZodOptional<z.ZodDate>;
        correlation_id: z.ZodOptional<z.ZodString>;
        page: z.ZodDefault<z.ZodNumber>;
        limit: z.ZodDefault<z.ZodNumber>;
        sort_by: z.ZodOptional<z.ZodString>;
        sort_order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        page: number;
        sort_order: "asc" | "desc";
        event_type?: string | undefined;
        event_category?: string | undefined;
        severity?: "CRITICAL" | "WARNING" | "INFO" | "DEBUG" | "ERROR" | undefined;
        user_id?: string | undefined;
        action?: string | undefined;
        outcome?: "SUCCESS" | "FAILURE" | "ERROR" | "PARTIAL" | "DENIED" | undefined;
        resource_type?: string | undefined;
        resource_id?: string | undefined;
        sort_by?: string | undefined;
        start_date?: Date | undefined;
        end_date?: Date | undefined;
        correlation_id?: string | undefined;
    }, {
        event_type?: string | undefined;
        event_category?: string | undefined;
        severity?: "CRITICAL" | "WARNING" | "INFO" | "DEBUG" | "ERROR" | undefined;
        user_id?: string | undefined;
        action?: string | undefined;
        outcome?: "SUCCESS" | "FAILURE" | "ERROR" | "PARTIAL" | "DENIED" | undefined;
        resource_type?: string | undefined;
        resource_id?: string | undefined;
        limit?: number | undefined;
        page?: number | undefined;
        sort_by?: string | undefined;
        sort_order?: "asc" | "desc" | undefined;
        start_date?: Date | undefined;
        end_date?: Date | undefined;
        correlation_id?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        limit: number;
        page: number;
        sort_order: "asc" | "desc";
        event_type?: string | undefined;
        event_category?: string | undefined;
        severity?: "CRITICAL" | "WARNING" | "INFO" | "DEBUG" | "ERROR" | undefined;
        user_id?: string | undefined;
        action?: string | undefined;
        outcome?: "SUCCESS" | "FAILURE" | "ERROR" | "PARTIAL" | "DENIED" | undefined;
        resource_type?: string | undefined;
        resource_id?: string | undefined;
        sort_by?: string | undefined;
        start_date?: Date | undefined;
        end_date?: Date | undefined;
        correlation_id?: string | undefined;
    };
}, {
    query: {
        event_type?: string | undefined;
        event_category?: string | undefined;
        severity?: "CRITICAL" | "WARNING" | "INFO" | "DEBUG" | "ERROR" | undefined;
        user_id?: string | undefined;
        action?: string | undefined;
        outcome?: "SUCCESS" | "FAILURE" | "ERROR" | "PARTIAL" | "DENIED" | undefined;
        resource_type?: string | undefined;
        resource_id?: string | undefined;
        limit?: number | undefined;
        page?: number | undefined;
        sort_by?: string | undefined;
        sort_order?: "asc" | "desc" | undefined;
        start_date?: Date | undefined;
        end_date?: Date | undefined;
        correlation_id?: string | undefined;
    };
}>;
export declare const sessionQuerySchema: z.ZodObject<{
    query: z.ZodObject<{
        page: z.ZodDefault<z.ZodNumber>;
        limit: z.ZodDefault<z.ZodNumber>;
        sort_by: z.ZodOptional<z.ZodString>;
        sort_order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        page: number;
        sort_order: "asc" | "desc";
        sort_by?: string | undefined;
    }, {
        limit?: number | undefined;
        page?: number | undefined;
        sort_by?: string | undefined;
        sort_order?: "asc" | "desc" | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        limit: number;
        page: number;
        sort_order: "asc" | "desc";
        sort_by?: string | undefined;
    };
}, {
    query: {
        limit?: number | undefined;
        page?: number | undefined;
        sort_by?: string | undefined;
        sort_order?: "asc" | "desc" | undefined;
    };
}>;
export declare const caseAccessQuerySchema: z.ZodObject<{
    query: z.ZodObject<{
        case_id: z.ZodOptional<z.ZodString>;
        page: z.ZodDefault<z.ZodNumber>;
        limit: z.ZodDefault<z.ZodNumber>;
        sort_by: z.ZodOptional<z.ZodString>;
        sort_order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        page: number;
        sort_order: "asc" | "desc";
        case_id?: string | undefined;
        sort_by?: string | undefined;
    }, {
        case_id?: string | undefined;
        limit?: number | undefined;
        page?: number | undefined;
        sort_by?: string | undefined;
        sort_order?: "asc" | "desc" | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        limit: number;
        page: number;
        sort_order: "asc" | "desc";
        case_id?: string | undefined;
        sort_by?: string | undefined;
    };
}, {
    query: {
        case_id?: string | undefined;
        limit?: number | undefined;
        page?: number | undefined;
        sort_by?: string | undefined;
        sort_order?: "asc" | "desc" | undefined;
    };
}>;
export declare const userIdParamSchema: z.ZodObject<{
    params: z.ZodObject<{
        userId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        userId: string;
    }, {
        userId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        userId: string;
    };
}, {
    params: {
        userId: string;
    };
}>;
export declare const caseIdParamSchema: z.ZodObject<{
    params: z.ZodObject<{
        caseId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        caseId: string;
    }, {
        caseId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        caseId: string;
    };
}, {
    params: {
        caseId: string;
    };
}>;
export declare const sessionIdParamSchema: z.ZodObject<{
    params: z.ZodObject<{
        sessionId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        sessionId: string;
    }, {
        sessionId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        sessionId: string;
    };
}, {
    params: {
        sessionId: string;
    };
}>;
export declare const authValidators: {
    login: z.ZodObject<{
        body: z.ZodObject<{
            email: z.ZodString;
            password: z.ZodString;
            totp_code: z.ZodOptional<z.ZodString>;
            backup_code: z.ZodOptional<z.ZodString>;
            remember_me: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            email: string;
            password: string;
            remember_me: boolean;
            totp_code?: string | undefined;
            backup_code?: string | undefined;
        }, {
            email: string;
            password: string;
            totp_code?: string | undefined;
            backup_code?: string | undefined;
            remember_me?: boolean | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        body: {
            email: string;
            password: string;
            remember_me: boolean;
            totp_code?: string | undefined;
            backup_code?: string | undefined;
        };
    }, {
        body: {
            email: string;
            password: string;
            totp_code?: string | undefined;
            backup_code?: string | undefined;
            remember_me?: boolean | undefined;
        };
    }>;
    refreshToken: z.ZodObject<{
        body: z.ZodObject<{
            refresh_token: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            refresh_token: string;
        }, {
            refresh_token: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        body: {
            refresh_token: string;
        };
    }, {
        body: {
            refresh_token: string;
        };
    }>;
    mfaVerify: z.ZodObject<{
        body: z.ZodObject<{
            code: z.ZodString;
            type: z.ZodEnum<["totp", "backup"]>;
        }, "strip", z.ZodTypeAny, {
            type: "totp" | "backup";
            code: string;
        }, {
            type: "totp" | "backup";
            code: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        body: {
            type: "totp" | "backup";
            code: string;
        };
    }, {
        body: {
            type: "totp" | "backup";
            code: string;
        };
    }>;
    changePassword: z.ZodObject<{
        body: z.ZodEffects<z.ZodObject<{
            current_password: z.ZodString;
            new_password: z.ZodString;
            confirm_password: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            current_password: string;
            new_password: string;
            confirm_password: string;
        }, {
            current_password: string;
            new_password: string;
            confirm_password: string;
        }>, {
            current_password: string;
            new_password: string;
            confirm_password: string;
        }, {
            current_password: string;
            new_password: string;
            confirm_password: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        body: {
            current_password: string;
            new_password: string;
            confirm_password: string;
        };
    }, {
        body: {
            current_password: string;
            new_password: string;
            confirm_password: string;
        };
    }>;
    forgotPassword: z.ZodObject<{
        body: z.ZodObject<{
            email: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            email: string;
        }, {
            email: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        body: {
            email: string;
        };
    }, {
        body: {
            email: string;
        };
    }>;
    resetPassword: z.ZodObject<{
        body: z.ZodEffects<z.ZodObject<{
            token: z.ZodString;
            new_password: z.ZodString;
            confirm_password: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            token: string;
            new_password: string;
            confirm_password: string;
        }, {
            token: string;
            new_password: string;
            confirm_password: string;
        }>, {
            token: string;
            new_password: string;
            confirm_password: string;
        }, {
            token: string;
            new_password: string;
            confirm_password: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        body: {
            token: string;
            new_password: string;
            confirm_password: string;
        };
    }, {
        body: {
            token: string;
            new_password: string;
            confirm_password: string;
        };
    }>;
    registerUser: z.ZodObject<{
        body: z.ZodObject<{
            employee_id: z.ZodString;
            email: z.ZodString;
            phone: z.ZodOptional<z.ZodString>;
            password: z.ZodString;
            full_name: z.ZodString;
            role: z.ZodNativeEnum<typeof UserRole>;
            department: z.ZodString;
            designation: z.ZodOptional<z.ZodString>;
            badge_number: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            email: string;
            role: UserRole;
            department: string;
            password: string;
            full_name: string;
            employee_id: string;
            phone?: string | undefined;
            designation?: string | undefined;
            badge_number?: string | undefined;
        }, {
            email: string;
            role: UserRole;
            department: string;
            password: string;
            full_name: string;
            employee_id: string;
            phone?: string | undefined;
            designation?: string | undefined;
            badge_number?: string | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        body: {
            email: string;
            role: UserRole;
            department: string;
            password: string;
            full_name: string;
            employee_id: string;
            phone?: string | undefined;
            designation?: string | undefined;
            badge_number?: string | undefined;
        };
    }, {
        body: {
            email: string;
            role: UserRole;
            department: string;
            password: string;
            full_name: string;
            employee_id: string;
            phone?: string | undefined;
            designation?: string | undefined;
            badge_number?: string | undefined;
        };
    }>;
    updateProfile: z.ZodObject<{
        body: z.ZodEffects<z.ZodObject<{
            full_name: z.ZodOptional<z.ZodString>;
            phone: z.ZodOptional<z.ZodString>;
            designation: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            full_name?: string | undefined;
            phone?: string | undefined;
            designation?: string | undefined;
        }, {
            full_name?: string | undefined;
            phone?: string | undefined;
            designation?: string | undefined;
        }>, {
            full_name?: string | undefined;
            phone?: string | undefined;
            designation?: string | undefined;
        }, {
            full_name?: string | undefined;
            phone?: string | undefined;
            designation?: string | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        body: {
            full_name?: string | undefined;
            phone?: string | undefined;
            designation?: string | undefined;
        };
    }, {
        body: {
            full_name?: string | undefined;
            phone?: string | undefined;
            designation?: string | undefined;
        };
    }>;
    setupMfa: z.ZodObject<{
        body: z.ZodObject<{
            verification_code: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            verification_code: string;
        }, {
            verification_code: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        body: {
            verification_code: string;
        };
    }, {
        body: {
            verification_code: string;
        };
    }>;
    disableMfa: z.ZodObject<{
        body: z.ZodObject<{
            password: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            password: string;
        }, {
            password: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        body: {
            password: string;
        };
    }, {
        body: {
            password: string;
        };
    }>;
    regenerateBackupCodes: z.ZodObject<{
        body: z.ZodObject<{
            password: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            password: string;
        }, {
            password: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        body: {
            password: string;
        };
    }, {
        body: {
            password: string;
        };
    }>;
    userQuery: z.ZodObject<{
        query: z.ZodObject<{
            role: z.ZodOptional<z.ZodNativeEnum<typeof UserRole>>;
            status: z.ZodOptional<z.ZodNativeEnum<typeof UserStatus>>;
            department: z.ZodOptional<z.ZodString>;
            search: z.ZodOptional<z.ZodString>;
            page: z.ZodDefault<z.ZodNumber>;
            limit: z.ZodDefault<z.ZodNumber>;
            sort_by: z.ZodOptional<z.ZodString>;
            sort_order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
        }, "strip", z.ZodTypeAny, {
            limit: number;
            page: number;
            sort_order: "asc" | "desc";
            role?: UserRole | undefined;
            department?: string | undefined;
            search?: string | undefined;
            status?: UserStatus | undefined;
            sort_by?: string | undefined;
        }, {
            role?: UserRole | undefined;
            department?: string | undefined;
            search?: string | undefined;
            status?: UserStatus | undefined;
            limit?: number | undefined;
            page?: number | undefined;
            sort_by?: string | undefined;
            sort_order?: "asc" | "desc" | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        query: {
            limit: number;
            page: number;
            sort_order: "asc" | "desc";
            role?: UserRole | undefined;
            department?: string | undefined;
            search?: string | undefined;
            status?: UserStatus | undefined;
            sort_by?: string | undefined;
        };
    }, {
        query: {
            role?: UserRole | undefined;
            department?: string | undefined;
            search?: string | undefined;
            status?: UserStatus | undefined;
            limit?: number | undefined;
            page?: number | undefined;
            sort_by?: string | undefined;
            sort_order?: "asc" | "desc" | undefined;
        };
    }>;
    auditQuery: z.ZodObject<{
        query: z.ZodObject<{
            user_id: z.ZodOptional<z.ZodString>;
            event_type: z.ZodOptional<z.ZodString>;
            event_category: z.ZodOptional<z.ZodString>;
            resource_type: z.ZodOptional<z.ZodString>;
            resource_id: z.ZodOptional<z.ZodString>;
            action: z.ZodOptional<z.ZodString>;
            outcome: z.ZodOptional<z.ZodEnum<["SUCCESS", "FAILURE", "PARTIAL", "DENIED", "ERROR"]>>;
            severity: z.ZodOptional<z.ZodEnum<["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]>>;
            start_date: z.ZodOptional<z.ZodDate>;
            end_date: z.ZodOptional<z.ZodDate>;
            correlation_id: z.ZodOptional<z.ZodString>;
            page: z.ZodDefault<z.ZodNumber>;
            limit: z.ZodDefault<z.ZodNumber>;
            sort_by: z.ZodOptional<z.ZodString>;
            sort_order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
        }, "strip", z.ZodTypeAny, {
            limit: number;
            page: number;
            sort_order: "asc" | "desc";
            event_type?: string | undefined;
            event_category?: string | undefined;
            severity?: "CRITICAL" | "WARNING" | "INFO" | "DEBUG" | "ERROR" | undefined;
            user_id?: string | undefined;
            action?: string | undefined;
            outcome?: "SUCCESS" | "FAILURE" | "ERROR" | "PARTIAL" | "DENIED" | undefined;
            resource_type?: string | undefined;
            resource_id?: string | undefined;
            sort_by?: string | undefined;
            start_date?: Date | undefined;
            end_date?: Date | undefined;
            correlation_id?: string | undefined;
        }, {
            event_type?: string | undefined;
            event_category?: string | undefined;
            severity?: "CRITICAL" | "WARNING" | "INFO" | "DEBUG" | "ERROR" | undefined;
            user_id?: string | undefined;
            action?: string | undefined;
            outcome?: "SUCCESS" | "FAILURE" | "ERROR" | "PARTIAL" | "DENIED" | undefined;
            resource_type?: string | undefined;
            resource_id?: string | undefined;
            limit?: number | undefined;
            page?: number | undefined;
            sort_by?: string | undefined;
            sort_order?: "asc" | "desc" | undefined;
            start_date?: Date | undefined;
            end_date?: Date | undefined;
            correlation_id?: string | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        query: {
            limit: number;
            page: number;
            sort_order: "asc" | "desc";
            event_type?: string | undefined;
            event_category?: string | undefined;
            severity?: "CRITICAL" | "WARNING" | "INFO" | "DEBUG" | "ERROR" | undefined;
            user_id?: string | undefined;
            action?: string | undefined;
            outcome?: "SUCCESS" | "FAILURE" | "ERROR" | "PARTIAL" | "DENIED" | undefined;
            resource_type?: string | undefined;
            resource_id?: string | undefined;
            sort_by?: string | undefined;
            start_date?: Date | undefined;
            end_date?: Date | undefined;
            correlation_id?: string | undefined;
        };
    }, {
        query: {
            event_type?: string | undefined;
            event_category?: string | undefined;
            severity?: "CRITICAL" | "WARNING" | "INFO" | "DEBUG" | "ERROR" | undefined;
            user_id?: string | undefined;
            action?: string | undefined;
            outcome?: "SUCCESS" | "FAILURE" | "ERROR" | "PARTIAL" | "DENIED" | undefined;
            resource_type?: string | undefined;
            resource_id?: string | undefined;
            limit?: number | undefined;
            page?: number | undefined;
            sort_by?: string | undefined;
            sort_order?: "asc" | "desc" | undefined;
            start_date?: Date | undefined;
            end_date?: Date | undefined;
            correlation_id?: string | undefined;
        };
    }>;
    sessionQuery: z.ZodObject<{
        query: z.ZodObject<{
            page: z.ZodDefault<z.ZodNumber>;
            limit: z.ZodDefault<z.ZodNumber>;
            sort_by: z.ZodOptional<z.ZodString>;
            sort_order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
        }, "strip", z.ZodTypeAny, {
            limit: number;
            page: number;
            sort_order: "asc" | "desc";
            sort_by?: string | undefined;
        }, {
            limit?: number | undefined;
            page?: number | undefined;
            sort_by?: string | undefined;
            sort_order?: "asc" | "desc" | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        query: {
            limit: number;
            page: number;
            sort_order: "asc" | "desc";
            sort_by?: string | undefined;
        };
    }, {
        query: {
            limit?: number | undefined;
            page?: number | undefined;
            sort_by?: string | undefined;
            sort_order?: "asc" | "desc" | undefined;
        };
    }>;
    caseAccessQuery: z.ZodObject<{
        query: z.ZodObject<{
            case_id: z.ZodOptional<z.ZodString>;
            page: z.ZodDefault<z.ZodNumber>;
            limit: z.ZodDefault<z.ZodNumber>;
            sort_by: z.ZodOptional<z.ZodString>;
            sort_order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
        }, "strip", z.ZodTypeAny, {
            limit: number;
            page: number;
            sort_order: "asc" | "desc";
            case_id?: string | undefined;
            sort_by?: string | undefined;
        }, {
            case_id?: string | undefined;
            limit?: number | undefined;
            page?: number | undefined;
            sort_by?: string | undefined;
            sort_order?: "asc" | "desc" | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        query: {
            limit: number;
            page: number;
            sort_order: "asc" | "desc";
            case_id?: string | undefined;
            sort_by?: string | undefined;
        };
    }, {
        query: {
            case_id?: string | undefined;
            limit?: number | undefined;
            page?: number | undefined;
            sort_by?: string | undefined;
            sort_order?: "asc" | "desc" | undefined;
        };
    }>;
    userIdParam: z.ZodObject<{
        params: z.ZodObject<{
            userId: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            userId: string;
        }, {
            userId: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        params: {
            userId: string;
        };
    }, {
        params: {
            userId: string;
        };
    }>;
    caseIdParam: z.ZodObject<{
        params: z.ZodObject<{
            caseId: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            caseId: string;
        }, {
            caseId: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        params: {
            caseId: string;
        };
    }, {
        params: {
            caseId: string;
        };
    }>;
    sessionIdParam: z.ZodObject<{
        params: z.ZodObject<{
            sessionId: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            sessionId: string;
        }, {
            sessionId: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        params: {
            sessionId: string;
        };
    }, {
        params: {
            sessionId: string;
        };
    }>;
};
//# sourceMappingURL=auth.validators.d.ts.map