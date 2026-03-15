# Patrimony

A personal wealth dashboard built with Next.js. Track your net worth, investments, pension, property value, and budget — all locally, with no data leaving your machine.

![Next.js](https://img.shields.io/badge/Next.js-black?logo=next.js) ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38bdf8?logo=tailwindcss&logoColor=white) ![Recharts](https://img.shields.io/badge/Recharts-22c55e)

---

## Features

- **Overview** — Net worth summary with a stacked area chart broken down by cash, investments, pensions, and property. Import your history via CSV.
- **Accounts** — Cash, ISA, and pension holdings with live prices pulled from Yahoo Finance.
- **Pension** — Project your pension pot to retirement with contribution modelling, year-on-year growth assumptions, and real-value (inflation-adjusted) output.
- **Budget** — Three-pot planning tool (Core Expenses / Savings / Free Expenditure) with itemised expense tracking.
- **Property** — Estimate your property's current value using the UK Land Registry House Price Index, with a 12-month projection and full equity breakdown (capital repaid vs. price appreciation).

## Stack

- [Next.js](https://nextjs.org/) (App Router)
- [Tailwind CSS](https://tailwindcss.com/)
- [Recharts](https://recharts.org/)
- Data stored locally in `/data/*.json` — nothing is sent to a server

## Getting Started

1. Clone the repo

```bash
git clone https://github.com/chriswuk-sketch/patrimony.git
cd patrimony

2. Install dependencies


npm install

3. Set up your data files

Copy the example data files and edit them with your own figures:


cp data/wealth.example.json data/wealth.json
cp data/history.example.json data/history.json
cp data/budget.example.json data/budget.json

4. Run the development server


npm run dev
Open http://localhost:3000 in your browser.

Data & Privacy
All data is stored in the /data folder on your own machine. These files are excluded from git via .gitignore and will never be committed or pushed to GitHub. The app makes two external network requests:

Yahoo Finance — to fetch live prices for holdings you configure (optional)
Land Registry HPI SPARQL endpoint — to fetch house price index data for your local authority (optional, Property tab only)
No personal data is transmitted anywhere else.

Notes
The Land Registry HPI endpoint can take up to 30 seconds to respond. Results are cached in localStorage for 24 hours.
HPI data typically lags the current date by 2–3 months.
Some smaller local authority districts may not have their own HPI data — try searching at county level instead
Live prices require a valid ticker symbol (e.g. VWRP.L) or ISIN resolvable via Yahoo Finance.

