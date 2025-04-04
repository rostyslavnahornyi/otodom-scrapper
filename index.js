import * as cheerio from "cheerio";
import axios from "axios";
import fs from "fs";
import { Telegraf } from "telegraf";
import puppeteer from "puppeteer";

const DOMAIN = "https://www.otodom.pl";
const URL =
  "https://www.otodom.pl/pl/wyniki/wynajem/mieszkanie/malopolskie/krakow/krakow/krakow?limit=36&extras=%5BIS_PRIVATE_OWNER%5D&by=LATEST&direction=DESC&viewType=listing";
const botToken = "6099185644:AAG9MvRPtxP8oHsw2doiiEQFNNTVcnwE9hI";

const bot = new Telegraf(botToken);

const main = async () => {
  const dbOld = JSON.parse(fs.readFileSync("./apartaments.json"));
  const allUrls = [...dbOld.oldUrls, ...dbOld.newUrls];
  const db = { newUrls: [], oldUrls: allUrls };

  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    );
    await page.goto(URL, { waitUntil: "networkidle2" });

    const html = await page.content();
    const $ = cheerio.load(html);

    const newUrls = [];

    // Step 1: Find the organic listings block
    const organicListings = $('[data-cy="search.listing.organic"]');

    // Step 2: Inside each organic listing block, find all links
    organicListings.each((_, el) => {
      $(el)
        .find('[data-cy="listing-item-link"]')
        .each((_, link) => {
          const href = $(link).attr("href");
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
    await bot.telegram.sendMessage(
      409287724,
      db.newUrls.join("\n\n") +
        `\n\nall: ${db.length}\nnewUrls: ${db.newUrls.length}\noldUrls: ${db.oldUrls.length}`
    );
  }

  fs.writeFileSync("./apartaments.json", JSON.stringify(db, null, 2));
};

setInterval(main, 3000);
t;
