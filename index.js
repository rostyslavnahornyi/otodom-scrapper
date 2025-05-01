import * as cheerio from "cheerio";
import axios from "axios";
import fs from "fs";
import { Telegraf } from "telegraf";
import puppeteer from "puppeteer";

const DOMAIN = "https://www.otodom.pl";
const URL =
  "https://www.otodom.pl/pl/wyniki/wynajem/mieszkanie,2-pokoje/wiele-lokalizacji?limit=36&priceMax=3500&daysSinceCreated=7&locations=%5Bmalopolskie%2Fkrakow%2Fkrakow%2Fkrakow%2Fczyzyny%2Cmalopolskie%2Fkrakow%2Fkrakow%2Fkrakow%2Fmistrzejowice%2Cmalopolskie%2Fkrakow%2Fkrakow%2Fkrakow%2Fbienczyce%2Cmalopolskie%2Fkrakow%2Fkrakow%2Fkrakow%2Fnowa-huta%2Fnowa-huta%5D&by=LATEST&direction=DESC&viewType=listing";
const botToken = "7631606729:AAEnMP8K1fdX8QCe2c2RH55imYtOaqBHHoI";

const bot = new Telegraf(botToken);

const main = async () => {
  console.log("MAIN START");
  const dbOld = JSON.parse(fs.readFileSync("./apartaments.json"));
  const allUrls = [...dbOld.oldUrls, ...dbOld.newUrls];
  const db = { newUrls: [], oldUrls: allUrls, users: dbOld.users };

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    );
    console.log(1);
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 150000 });
    console.log(2);

    const html = await page.content();
    const $ = cheerio.load(html);

    const newUrls = [];

    // Step 1: Find the organic listings block
    const organicListings = $('[data-cy="search.listing.organic"]');

    // Step 2: Inside each organic listing block, find all links
    organicListings.each((_, el) => {
      $(el)
        .find('[data-cy="listing-item-link"]')
        .each((i, link) => {
          const href = !$(link).attr("href").includes("/hpr/")
            ? $(link).attr("href")
            : undefined;
          console.log(i, { href });
          if (href) {
            const fullUrl = href.startsWith("http") ? href : DOMAIN + href;
            if (!allUrls.includes(fullUrl)) {
              newUrls.push(fullUrl);
            }
          }
        });
    });

    db.newUrls = newUrls;

    await browser.close();
  } catch (error) {
    console.log("Scraping error:", error.message);
  }

  db.length = db.newUrls.length + db.oldUrls.length;

  if (db.newUrls.length !== 0) {
    dbOld.users.forEach(async (id) => {
      await bot.telegram.sendMessage(
        id,
        db.newUrls.join("\n\n") +
          `\n\nall: ${db.length}\nnewUrls: ${db.newUrls.length}\noldUrls: ${db.oldUrls.length}`
      );
    });
  }

  fs.writeFileSync("./apartaments.json", JSON.stringify(db, null, 2));
};

bot.start((ctx) => {
  const db = JSON.parse(fs.readFileSync("./apartaments.json"));

  db.users = [...db.users, ctx.chat.id];
  fs.writeFileSync("./apartaments.json", JSON.stringify(db, null, 2));
});

bot.launch(() => setInterval(main, 7500));
