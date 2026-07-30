import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { sendMail } from "./mail.js";

console.log(process.env.MAIL_USER);
console.log(process.env.MAIL_PASS?.length);



let credentials;

if (process.env.GA4_KEY) {
  credentials = JSON.parse(process.env.GA4_KEY);
} else {
  credentials = JSON.parse(
    fs.readFileSync("ga4-key.json", "utf8")
  );
}


const client = new BetaAnalyticsDataClient({
  credentials,
});

const channelNames = {
  "Organic Search": "Google自然検索",
  "Paid Social": "SNS広告",
  "Direct": "直接アクセス",
  "Referral": "他サイト経由",
  "Organic Social": "SNS自然流入",
  "Organic Shopping": "Googleショッピング",
  "Paid Search": "検索広告",
  "Display": "ディスプレイ広告"
};

async function getReport(startDate, endDate) {

  const [response] = await client.runReport({

    property: "properties/294655636",

    dateRanges: [
      {
        startDate,
        endDate,
      },
    ],

    metrics: [
      {
        name: "purchaseRevenue",
      },
      {
        name: "transactions",
      },
    ],
  });


  const revenue = Math.round(
    Number(response.rows?.[0]?.metricValues?.[0]?.value || 0)
  );


  const transactions = Number(
    response.rows?.[0]?.metricValues?.[1]?.value || 0
  );


  const average = transactions
    ? Math.round(revenue / transactions)
    : 0;


  return {
    revenue,
    transactions,
    average,
  };
}

function getLastMonthRange() {

  const now = new Date();

  const firstDayThisMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  );

  const firstDayLastMonth = new Date(
    now.getFullYear(),
    now.getMonth() - 1,
    1
  );

  const lastDayLastMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    0
  );


  return {
    startDate:
      `${firstDayLastMonth.getFullYear()}-${String(
        firstDayLastMonth.getMonth() + 1
      ).padStart(2, "0")}-01`,

    endDate:
      `${lastDayLastMonth.getFullYear()}-${String(
        lastDayLastMonth.getMonth() + 1
      ).padStart(2, "0")}-${String(
        lastDayLastMonth.getDate()
      ).padStart(2, "0")}`
  };
}

async function getChannelReport(startDate, endDate) {

  const [response] = await client.runReport({

    property: "properties/294655636",

    dateRanges: [
      {
        startDate,
        endDate,
      },
    ],

    dimensions: [
      {
        name: "sessionDefaultChannelGroup",
      },
    ],

    metrics: [
      {
        name: "purchaseRevenue",
      },
    ],
  });


  return response.rows?.map(row => {

    return {
      channel: row.dimensionValues[0].value,
      revenue: Math.round(
        Number(row.metricValues[0].value)
      ),
    };

  }) || [];

}

async function getItemReport(startDate, endDate) {

  const [response] = await client.runReport({

    property: "properties/294655636",

    dateRanges: [
      {
        startDate,
        endDate,
      },
    ],

    dimensions: [
      {
        name: "itemName",
      },
    ],

    metrics: [
      {
        name: "itemRevenue",
      },
    ],
  });


  return response.rows?.map(row => {

    return {
      name: row.dimensionValues[0].value,

      revenue: Math.round(
        Number(row.metricValues[0].value)
      ),
    };

  }) || [];

}

const yesterday = await getReport(
  "yesterday",
  "yesterday"
);


const now = new Date();

const startOfMonth = `${now.getFullYear()}-${String(
  now.getMonth() + 1
).padStart(2, "0")}-01`;


const thisMonth = await getReport(
  startOfMonth,
  "today"
);

const lastMonthRange = getLastMonthRange();

const lastMonth = await getReport(
  lastMonthRange.startDate,
  lastMonthRange.endDate
);

const channels = await getChannelReport(
  startOfMonth,
  "today"
);

const items = await getItemReport(
  startOfMonth,
  "today"
);

function calcRate(current, previous) {

  if (previous === 0) {
    return "比較不可";
  }

  const rate =
    ((current - previous) / previous) * 100;

  const sign = rate >= 0 ? "+" : "";

  return `${sign}${rate.toFixed(1)}%`;
}


const salesRate = calcRate(
  thisMonth.revenue,
  lastMonth.revenue
);


const orderRate = calcRate(
  thisMonth.transactions,
  lastMonth.transactions
);

const itemRanking = items
  .sort((a, b) => b.revenue - a.revenue)
  .slice(0, 5)
  .map((item, index) => {

    const rank =
      index === 0 ? "🥇 1位" :
      index === 1 ? "🥈 2位" :
      index === 2 ? "🥉 3位" :
      `${index + 1}位`;

    return `${rank} ${item.name}
${item.revenue.toLocaleString()}円`;

  })
  .join("\n\n");

const channelRanking = channels
  .sort((a, b) => b.revenue - a.revenue)
  .map((c, index) => {

    const rank =
      index === 0 ? "🥇 1位" :
      index === 1 ? "🥈 2位" :
      index === 2 ? "🥉 3位" :
      `${index + 1}位`;

    return `${rank} ${channelNames[c.channel] || c.channel}（${c.channel}）
${c.revenue.toLocaleString()}円`;

  })
  .join("\n\n");

const body = `
あわづや EC経営レポート

■昨日
売上：${yesterday.revenue.toLocaleString()}円
注文数：${yesterday.transactions}件
平均注文単価：${yesterday.average.toLocaleString()}円

■今月累計
売上：${thisMonth.revenue.toLocaleString()}円
注文数：${thisMonth.transactions}件
平均注文単価：${thisMonth.average.toLocaleString()}円

■前月比
売上
今月：${thisMonth.revenue.toLocaleString()}円
先月：${lastMonth.revenue.toLocaleString()}円
${salesRate}

注文数
今月：${thisMonth.transactions}件
先月：${lastMonth.transactions}件
${orderRate}

■購入経路別売上ランキング
${channelRanking}

■商品別売上ランキング
${itemRanking}

GA4自動取得
`;



await sendMail(
  "【あわづやEC経営レポート】",
  body
);