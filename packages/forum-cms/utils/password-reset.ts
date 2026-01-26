import envVar from "../environment-variables";
import { getMailer } from "./mailer";

type SendPasswordResetEmailArgs = {
    email: string;
    token: string;
};

function buildResetUrl(email: string, token: string) {
    const base = (envVar.passwordReset.baseUrl || "").replace(/\/$/, "");
    const params = new URLSearchParams({
        email,
        token,
    });

    return `${
        base || "http://localhost:3000"
    }/reset-password?${params.toString()}`;
}

export async function sendPasswordResetEmail({
    email,
    token,
}: SendPasswordResetEmailArgs) {
    const resetUrl = buildResetUrl(email, token);
    const subject = "重設密碼通知";
    const textBody = [
        "您好：",
        "",
        "我們收到您重設 RTI Forum CMS 密碼的請求。",
        `請點擊以下連結完成密碼重設：${resetUrl}`,
        "",
        `此連結 ${envVar.passwordReset.tokensValidForMins} 分鐘內有效，若您未提出申請請忽略本信。`,
    ].join("\n");

    const htmlBody = `
    <p>您好：</p>
    <p>我們收到您重設 RTI Forum CMS 密碼的請求。</p>
    <p><a href="${resetUrl}" target="_blank" rel="noreferrer">點擊這裡重設密碼</a></p>
    <p>此連結 ${envVar.passwordReset.tokensValidForMins} 分鐘內有效，若您未提出申請請忽略本信。</p>
  `;

    console.log(
        JSON.stringify({
            severity: "INFO",
            message: "Generated password reset link",
            type: "PASSWORD_RESET",
            email,
            resetUrl,
            timestamp: new Date().toISOString(),
        })
    );

    try {
        const mailer = getMailer();
        await mailer.sendMail({
            to: email,
            subject,
            text: textBody,
            html: htmlBody,
        });
    } catch (error) {
        console.error(
            JSON.stringify({
                severity: "ERROR",
                message: "寄送重設密碼信件失敗",
                type: "PASSWORD_RESET",
                email,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString(),
            })
        );
        throw error;
    }
}
