import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
const API = "https://ws.digiteka.com/api";
const { API_EMAIL, API_PASSWORD } = process.env;
if (!API_EMAIL || !API_PASSWORD) {
    console.error("API_EMAIL and API_PASSWORD must be set");
    process.exit(1);
}
const groupMapping = {
    "20 Minutes": "20 Minutes",
    "Centre Presse Aveyron": "Groupe La Dépêche du Midi",
    "Corse Matin": "Groupe La Provence",
    "Courrier Picard": "Groupe ROSSEL",
    "Diverto": "Diverto",
    "DNA": "Groupe EBRA",
    "Groupe Centre France": "Groupe Centre France",
    "Groupe EBRA": "Groupe EBRA",
    "Groupe La Dépêche du Midi - Pôle Ouest": "Groupe La Dépêche du Midi",
    "Groupe Nice Matin": "Groupe Nice Matin",
    "Groupe Sud Ouest": "Groupe Sud Ouest",
    "JSL": "Groupe EBRA",
    "L'Alsace": "Groupe EBRA",
    "L'Est Eclair": "Groupe ROSSEL",
    "L'Est Républicain": "Groupe EBRA",
    "L'Indépendant": "Groupe La Dépêche du Midi",
    "L'Union": "Groupe ROSSEL",
    "La Nouvelle République": "Groupe NRCO",
    "La Provence": "Groupe La Provence",
    "La Voix du Nord": "Groupe ROSSEL",
    "Le Bien public": "Groupe EBRA",
    "Le Dauphiné Libéré": "Groupe EBRA",
    "Le Progrès": "Groupe EBRA",
    "Le Républicain Lorrain": "Groupe EBRA",
    "Midi Libre": "Groupe La Dépêche du Midi",
    "Midi Olympique": "Groupe La Dépêche du Midi",
    "Nord Littoral": "Groupe ROSSEL",
    "Ouest France": "Groupe Ouest France",
    "Ouest France Emploi": "Groupe Ouest France",
    "S.N.I.M (Paris-Normandie)": "Groupe ROSSEL",
    "Vosges Matin": "Groupe EBRA",
};
let token;
let loginInFlight;
async function login() {
    const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: API_EMAIL, password: API_PASSWORD }),
    });
    if (!res.ok) {
        throw new Error(`Digiteka login error: HTTP ${res.status}`);
    }
    const data = (await res.json());
    return data.access_token;
}
async function getToken(force = false) {
    if (force) {
        token = undefined;
    }
    if (token) {
        return token;
    }
    loginInFlight ??= login().finally(() => (loginInFlight = undefined));
    return (token = await loginInFlight);
}
async function apiFetch(path, init = {}) {
    const send = async (force) => {
        const token = await getToken(force);
        return fetch(`${API}${path}`, {
            ...init,
            headers: {
                ...init.headers,
                authorization: `Bearer ${token}`,
                "content-type": "application/json",
            },
            redirect: "follow",
        });
    };
    const res = await send(false);
    return res.status === 401 ? send(true) : res; // token expired: re-login once
}
function createServer() {
    const server = new McpServer({ name: "digiteka", version: "1.0.0" });
    server.registerTool("get-videofeed-report", {
        description: "Get the videofeed report",
        // inputSchema: z.object({
        //   state: z
        //     .string()
        //     .length(2)
        //     .describe("Two-letter US state code, e.g. CA"),
        // }),
        outputSchema: z.array(z.object({
            date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
            group: z.string(),
            streams: z.int(),
        })),
    }, async ( /* { state } */) => {
        // const code = state.toUpperCase();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 13);
        startDate.setDate(1);
        const endDate = new Date();
        endDate.setDate(0); // last day of previous month
        const res = await apiFetch(`/studio/generate`, {
            method: "POST",
            body: JSON.stringify({
                ranges: [
                    {
                        startDate: startDate.toISOString().split("T")[0],
                        endDate: endDate.toISOString().split("T")[0],
                        period: "P",
                    },
                    null,
                ],
                data: [
                    "streams",
                ],
                dimensions: ["siteCompanyName"],
                filters: [],
                granularity: "month",
                context: "videofeed",
                subcontext: "editor",
            }),
        });
        console.error(JSON.stringify(res));
        if (!res.ok) {
            return {
                content: [
                    { type: "text", text: `Digiteka API error: HTTP ${res.status}` },
                ],
                isError: true,
            };
        }
        const { dimensions, columns, body } = (await res.json());
        if (body.length === 0) {
            return {
                content: [{ type: "text", text: `Empty response.` }],
            };
        }
        // generate JSON report
        const report = body.map((row) => {
            const obj = {};
            dimensions.forEach((dim, i) => {
                obj[dim.label] = row.headers[i].trim();
            });
            columns.forEach((col, i) => {
                obj[col.label] = row.body[0][i];
            });
            return obj;
        });
        const fixedReport = [];
        const reportMap = {};
        report.forEach((row) => {
            if (!groupMapping[row.company]) {
                return;
            }
            row.group = groupMapping[row.company];
            row.date = `${row.mois}-01`;
            delete row.company;
            delete row.mois;
            const key = `${row.group}-${row.date}`;
            if (!reportMap[key]) {
                reportMap[key] = { ...row };
            }
            else {
                reportMap[key].streams += row.streams;
            }
        });
        for (const key in reportMap) {
            fixedReport.push(reportMap[key]);
        }
        return {
            resultType: "complete",
            content: [{ type: "text", text: JSON.stringify(fixedReport) }],
            structuredContent: fixedReport,
        };
    });
    return server;
}
void serveStdio(createServer);
console.error("Digiteka MCP server running on stdio");
