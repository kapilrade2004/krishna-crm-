'use strict';

require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const { connectDB, sequelize } = require('../config/database');
const { syncModels, Customer, Order } = require('../models');

// Array of exact raw order rows parsed cleanly
const orderRows = [
  {
    orderId: "407-2945525-5496354",
    buyerName: "Thokcho. BisheshKumar singh",
    buyerPhone: "9774388907",
    shipPhone: "9774388907",
    sku: "Mapp-NA-0AVR-AC6O",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-18T18:30:00+00:00",
    latestDeliveryDate: "2026-07-19T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "405-8840886-4619533",
    buyerName: "Sharad Gaikwad",
    buyerPhone: "9702778550",
    shipPhone: "9702778550",
    sku: "Tata Mesh Small",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-11T18:30:00+00:00",
    latestDeliveryDate: "2026-07-12T18:29:59+00:00",
    customerReply: "1",
    actions: "1. WhatsApp message\n2. CALL\n3. WhatsApp Call\n4. Followup whatsapp message\n5. Product wise whatsapp template"
  },
  {
    orderId: "407-1378158-5645954",
    buyerName: "Errol",
    buyerPhone: "7718844503",
    shipPhone: "9223450586",
    sku: "Pipe-For-Sure Delight NXT RO+UV",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-09T18:30:00+00:00",
    latestDeliveryDate: "2026-07-10T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "403-0347790-4225118",
    buyerName: "Radha Bhavyasree Karumuri",
    buyerPhone: "9968282220",
    shipPhone: "9968282220",
    sku: "Urban Native M1 Cover",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-09T18:30:00+00:00",
    latestDeliveryDate: "2026-07-10T18:29:59+00:00",
    customerReply: "0",
    actions: ""
  },
  {
    orderId: "404-3126256-9121964",
    buyerName: "Shah pritesh",
    buyerPhone: "6355863951",
    shipPhone: "6355863951",
    sku: "Aquaguard-Superio-Pure-Silicone-Pipe",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-09T18:30:00+00:00",
    latestDeliveryDate: "2026-07-10T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "403-9950002-3716358",
    buyerName: "Ravi sodah",
    buyerPhone: "9892122362",
    shipPhone: "9892122362",
    sku: "Pipe-For-Sure Delight NXT RO+UV",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-09T18:30:00+00:00",
    latestDeliveryDate: "2026-07-10T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "403-3393924-5473932",
    buyerName: "NiTiN S",
    buyerPhone: "9969539874",
    shipPhone: "9969539874",
    sku: "Aquaguard Sure Delight Silicone Tube",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-10T18:30:00+00:00",
    latestDeliveryDate: "2026-07-11T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "402-8258033-1155527",
    buyerName: "Adlon Pereira",
    buyerPhone: "9819880245",
    shipPhone: "9819880245",
    sku: "Urban Native M1 Cover",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-10T18:30:00+00:00",
    latestDeliveryDate: "2026-07-11T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "404-7379553-7360345",
    buyerName: "Raaj",
    buyerPhone: "9820242530",
    shipPhone: "9820242530",
    sku: "Mapp-Top-Mesh",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-12T18:30:00+00:00",
    latestDeliveryDate: "2026-07-13T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "402-6409348-1820357",
    buyerName: "Tejan Yashwant Ranshevare",
    buyerPhone: "9503226203",
    shipPhone: "9503226203",
    sku: "Urban Native M2_Protective Cover-New",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-10T18:30:00+00:00",
    latestDeliveryDate: "2026-07-11T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "402-5163798-7817902",
    buyerName: "Pankaj nipurte",
    buyerPhone: "9673185427",
    shipPhone: "9673185427",
    sku: "Urban Native M1 Cover",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-10T18:30:00+00:00",
    latestDeliveryDate: "2026-07-11T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "405-9161329-6718730",
    buyerName: "Dipika Sinha",
    buyerPhone: "7710814573",
    shipPhone: "7710814573",
    sku: "Pipe-For-Sure Delight NXT RO+UV",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-11T18:30:00+00:00",
    latestDeliveryDate: "2026-07-12T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "403-7045217-4853958",
    buyerName: "Tanvi",
    buyerPhone: "9820456409",
    shipPhone: "9820456409",
    sku: "Aquaguard Crest PVC Tube",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-10T18:30:00+00:00",
    latestDeliveryDate: "2026-07-11T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "404-8243717-1153106",
    buyerName: "Kavita Vishwakarma",
    buyerPhone: "7447836401",
    shipPhone: "7447836401",
    sku: "Urban Native M2_Protective Cover-New",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-11T18:30:00+00:00",
    latestDeliveryDate: "2026-07-12T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "402-9673968-0063511",
    buyerName: "Vikas Chitnis",
    buyerPhone: "9769912322",
    shipPhone: "9769912322",
    sku: "Aquaguard LG spanner",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-10T18:30:00+00:00",
    latestDeliveryDate: "2026-07-11T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "407-7473367-1764300",
    buyerName: "Suprita",
    buyerPhone: "9108720177",
    shipPhone: "9108720177",
    sku: "Pipe Dr Aquaguard Compact Model",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-13T18:30:00+00:00",
    latestDeliveryDate: "2026-07-14T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "171-4107840-9689913",
    buyerName: "Siddhesh Gupta",
    buyerPhone: "9699250572",
    shipPhone: "9699250572",
    sku: "Urban Native M0 Cover",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-11T18:30:00+00:00",
    latestDeliveryDate: "2026-07-12T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "407-7611221-5053122",
    buyerName: "sreenivasa",
    buyerPhone: "9581356921",
    shipPhone: "9581356921",
    sku: "Mapp-Top-Mesh",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-13T18:30:00+00:00",
    latestDeliveryDate: "2026-07-14T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "406-2000073-2423542",
    buyerName: "Sirmela",
    buyerPhone: "8903845363",
    shipPhone: "9438574727",
    sku: "AK-TUBE-1.5M-TRANSPARENT",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-13T18:30:00+00:00",
    latestDeliveryDate: "2026-07-14T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "407-4533552-6955526",
    buyerName: "Nivedita Chaudhari",
    buyerPhone: "9689493664",
    shipPhone: "9689493664",
    sku: "1-Pc-RO Spanner-Black",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-11T18:30:00+00:00",
    latestDeliveryDate: "2026-07-12T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "404-1368389-5981940",
    buyerName: "Vamsi krish",
    buyerPhone: "000-000-0000",
    shipPhone: "8500346624",
    sku: "Livpure Bolt Silicone Pipe",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-13T18:30:00+00:00",
    latestDeliveryDate: "2026-07-14T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "402-4600213-2657135",
    buyerName: "Karike Rahul Shankar",
    buyerPhone: "9121447494",
    shipPhone: "9121447494",
    sku: "Livpure Bolt Silicone Pipe",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-13T18:30:00+00:00",
    latestDeliveryDate: "2026-07-14T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "404-6161180-0187558",
    buyerName: "B VIGNESHWARAN",
    buyerPhone: "9080748982",
    shipPhone: "9655866843",
    sku: "1-Pc-RO Spanner-Black",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-14T18:30:00+00:00",
    latestDeliveryDate: "2026-07-15T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "403-8491802-7233107",
    buyerName: "tapendra narayan pandit",
    buyerPhone: "9326973879",
    shipPhone: "9881722239",
    sku: "Mapp-Top-Mesh",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-13T18:30:00+00:00",
    latestDeliveryDate: "2026-07-14T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "403-9303043-8765130",
    buyerName: "Ganapati Vaidya",
    buyerPhone: "9380981197",
    shipPhone: "9380981197",
    sku: "Mapp-Top-Mesh",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-12T18:30:00+00:00",
    latestDeliveryDate: "2026-07-13T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "407-8294559-3251553",
    buyerName: "Giri",
    buyerPhone: "9492327707",
    shipPhone: "9492327707",
    sku: "Aquaguard Ritz Pro Silicone Tube",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-13T18:30:00+00:00",
    latestDeliveryDate: "2026-07-14T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "171-5107322-4269917",
    buyerName: "Sumaiya",
    buyerPhone: "8867044752",
    shipPhone: "8867044752",
    sku: "Livpure-Allura-Silicone-Tube",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-14T18:30:00+00:00",
    latestDeliveryDate: "2026-07-15T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "404-3203825-7282713",
    buyerName: "Arun P",
    buyerPhone: "8907555259",
    shipPhone: "8907555259",
    sku: "1-Pc-RO Spanner-Black",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-13T18:30:00+00:00",
    latestDeliveryDate: "2026-07-14T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "171-2699609-5678751",
    buyerName: "priya",
    buyerPhone: "8220387245",
    shipPhone: "8220387245",
    sku: "Aquaguard Astor Silicone Tube",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-12T18:30:00+00:00",
    latestDeliveryDate: "2026-07-13T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "403-4573153-8384303",
    buyerName: "Ritika Arya",
    buyerPhone: "7737711889",
    shipPhone: "7737711889",
    sku: "Pipe-For-Sure Delight NXT RO+UV",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-13T18:30:00+00:00",
    latestDeliveryDate: "2026-07-14T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "405-3418264-1250734",
    buyerName: "bharti",
    buyerPhone: "9610939444",
    shipPhone: "9610939444",
    sku: "Livpure-Allura-Silicone-Tube",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-13T18:30:00+00:00",
    latestDeliveryDate: "2026-07-14T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "408-8076168-1552321",
    buyerName: "Madhusudhanreddy",
    buyerPhone: "",
    shipPhone: "",
    sku: "Livpure-Allura-Silicone-Tube",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-12T18:30:00+00:00",
    latestDeliveryDate: "2026-07-13T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "171-5971456-2032358",
    buyerName: "S.Ravi Kiran",
    buyerPhone: "9032879816",
    shipPhone: "9032879816",
    sku: "Matka Silicone Tube",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-14T18:30:00+00:00",
    latestDeliveryDate: "2026-07-15T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "405-1955845-2727528",
    buyerName: "leelaprasad",
    buyerPhone: "9490117084",
    shipPhone: "9490117084",
    sku: "AKB-LIVPURE-TAP",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-13T18:30:00+00:00",
    latestDeliveryDate: "2026-07-14T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "402-4046266-8345140",
    buyerName: "Sumeet",
    buyerPhone: "8885316062",
    shipPhone: "8885316062",
    sku: "Livpure Bolt Silicone Pipe",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-13T18:30:00+00:00",
    latestDeliveryDate: "2026-07-14T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "404-2247130-5399514",
    buyerName: "t p hanumanth rao",
    buyerPhone: "",
    shipPhone: "",
    sku: "Aquaguard LG spanner",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-13T18:30:00+00:00",
    latestDeliveryDate: "2026-07-14T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "406-3897779-4256363",
    buyerName: "Namita Rath",
    buyerPhone: "7972150512",
    shipPhone: "7972150512",
    sku: "Pureit-classic-ro-mf-pure-silicone-pipe",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-11T18:30:00+00:00",
    latestDeliveryDate: "2026-07-12T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "406-4719493-2846704",
    buyerName: "priyanka",
    buyerPhone: "8105099486",
    shipPhone: "8105099486",
    sku: "AO Smith ProPlanet Silicone Tube",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-13T18:30:00+00:00",
    latestDeliveryDate: "2026-07-14T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "408-8198721-9804365",
    buyerName: "Neil wakankar",
    buyerPhone: "9405422484",
    shipPhone: "9405422484",
    sku: "1-Pc-RO Spanner-Black",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-11T18:30:00+00:00",
    latestDeliveryDate: "2026-07-12T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "405-0145530-5705171",
    buyerName: "Dharmendra Vishwakarma",
    buyerPhone: "8349360133",
    shipPhone: "8349360133",
    sku: "Tata Mesh Small",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-12T18:30:00+00:00",
    latestDeliveryDate: "2026-07-13T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "406-3210380-9336350",
    buyerName: "Naveena",
    buyerPhone: "9629324462",
    shipPhone: "9629324462",
    sku: "Aqua Innovica Cover",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-13T18:30:00+00:00",
    latestDeliveryDate: "2026-07-14T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "406-9363946-5153948",
    buyerName: "Nithisha Suggala",
    buyerPhone: "8328082725",
    shipPhone: "8328082725",
    sku: "Kent Sapphire RO-Cover",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-14T18:30:00+00:00",
    latestDeliveryDate: "2026-07-15T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "403-4592554-7321116",
    buyerName: "Vandana Parkar",
    buyerPhone: "8770850658",
    shipPhone: "8770850658",
    sku: "Aqua-D-Pure-Cover",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-13T18:30:00+00:00",
    latestDeliveryDate: "2026-07-14T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "408-0027718-3701949",
    buyerName: "Venky",
    buyerPhone: "9490119340",
    shipPhone: "9490119340",
    sku: "Mapp-Top-Mesh",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-13T18:30:00+00:00",
    latestDeliveryDate: "2026-07-14T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "171-1181945-0994716",
    buyerName: "Devi k",
    buyerPhone: "8939224464",
    shipPhone: "8939224464",
    sku: "Livpure-Allura-Silicone-Tube",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-13T18:30:00+00:00",
    latestDeliveryDate: "2026-07-14T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "408-7038165-0447538",
    buyerName: "Manikandadas B",
    buyerPhone: "9894728811",
    shipPhone: "9894728811",
    sku: "Pipe-For-Sure Delight NXT RO+UV",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-12T18:30:00+00:00",
    latestDeliveryDate: "2026-07-13T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "403-7214829-0269141",
    buyerName: "Suhaasbisuzy",
    buyerPhone: "8197731753",
    shipPhone: "8197731753",
    sku: "Pipe-For-Sure Delight NXT RO+UV",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-14T18:30:00+00:00",
    latestDeliveryDate: "2026-07-15T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "402-2562856-3743544",
    buyerName: "Manohar",
    buyerPhone: "9900244728",
    shipPhone: "9900244728",
    sku: "Mapp-Top-Mesh",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-13T18:30:00+00:00",
    latestDeliveryDate: "2026-07-14T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "405-0153361-1173916",
    buyerName: "M Ramanathan",
    buyerPhone: "9845028399",
    shipPhone: "9845028399",
    sku: "Havells Delight Alkaline Silicone Tube",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-13T18:30:00+00:00",
    latestDeliveryDate: "2026-07-14T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "171-0939900-4334747",
    buyerName: "Ashish aggarwal",
    buyerPhone: "9990005511",
    shipPhone: "9990005511",
    sku: "1-Pc-RO Spanner-Black",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-13T18:30:00+00:00",
    latestDeliveryDate: "2026-07-14T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "405-7264386-3573110",
    buyerName: "Shishpal",
    buyerPhone: "9813884219",
    shipPhone: "9813884219",
    sku: "Mapp-AKB-TP-1.5M-RO",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-13T18:30:00+00:00",
    latestDeliveryDate: "2026-07-14T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "402-9508047-9100315",
    buyerName: "Ganthimathi",
    buyerPhone: "9443517079",
    shipPhone: "9443517079",
    sku: "1-Pc-RO Spanner-Black",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-13T18:30:00+00:00",
    latestDeliveryDate: "2026-07-14T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "406-6569219-3693159",
    buyerName: "Veena",
    buyerPhone: "8296030969",
    shipPhone: "8296030969",
    sku: "Aquaguard-Superio-Pure-Silicone-Pipe",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-13T18:30:00+00:00",
    latestDeliveryDate: "2026-07-14T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "404-3048999-3610750",
    buyerName: "Sridevi Ravulapalli",
    buyerPhone: "6304302695",
    shipPhone: "6304302695",
    sku: "AKB-LIVPURE-TAP",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-14T18:30:00+00:00",
    latestDeliveryDate: "2026-07-15T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "404-8500825-8984307",
    buyerName: "Vimal Chourey",
    buyerPhone: "7415301620",
    shipPhone: "7415301620",
    sku: "Mapp-Top-Mesh",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-12T18:30:00+00:00",
    latestDeliveryDate: "2026-07-13T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "171-7081829-9913934",
    buyerName: "arun",
    buyerPhone: "9944072068",
    shipPhone: "9944072068",
    sku: "1-Pc-RO Spanner-Black",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-13T18:30:00+00:00",
    latestDeliveryDate: "2026-07-14T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "407-1752484-5649903",
    buyerName: "Dr.sabitha thallapelli",
    buyerPhone: "9885219076",
    shipPhone: "9885219076",
    sku: "Aqua-D-Pure-Cover",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-13T18:30:00+00:00",
    latestDeliveryDate: "2026-07-14T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "407-8709001-9901169",
    buyerName: "Krishna",
    buyerPhone: "7339016375",
    shipPhone: "7339016375",
    sku: "Pureit Wave Silicone Pipe",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-14T18:30:00+00:00",
    latestDeliveryDate: "2026-07-15T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "408-7714185-8030747",
    buyerName: "radave67@gmail.com",
    buyerPhone: "8156077061",
    shipPhone: "8156077061",
    sku: "Pipe-For- LG Puricare RO+UV",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-12T18:30:00+00:00",
    latestDeliveryDate: "2026-07-13T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "403-7885019-5289153",
    buyerName: "karthikeyan",
    buyerPhone: "9867425685",
    shipPhone: "9867425685",
    sku: "1-Pc-RO Spanner-Black",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-13T18:30:00+00:00",
    latestDeliveryDate: "2026-07-14T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "408-7286890-6148349",
    buyerName: "Siddharth Choudhary",
    buyerPhone: "8892187777",
    shipPhone: "8892187777",
    sku: "AKB-LIVPURE-TAP",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-13T18:30:00+00:00",
    latestDeliveryDate: "2026-07-14T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "405-5184294-0877126",
    buyerName: "Dipti",
    buyerPhone: "9818768331",
    shipPhone: "9818768331",
    sku: "Mapp-Top-Mesh",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-13T18:30:00+00:00",
    latestDeliveryDate: "2026-07-14T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "404-8883320-7849957",
    buyerName: "Liyakhath Shareef",
    buyerPhone: "7708897916",
    shipPhone: "7708897916",
    sku: "Aqua Innovica Cover",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-13T18:30:00+00:00",
    latestDeliveryDate: "2026-07-14T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "404-6721368-6509155",
    buyerName: "Phalgun Soni",
    buyerPhone: "9413479267",
    shipPhone: "9413479267",
    sku: "Kent Supreme Copper PVC Pipe",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-13T18:30:00+00:00",
    latestDeliveryDate: "2026-07-14T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "406-5912450-0136312",
    buyerName: "Swetha Murugesh",
    buyerPhone: "9535614298",
    shipPhone: "9535614298",
    sku: "Aquaguard-Copper-Superio-PVC-Pipe",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-13T18:30:00+00:00",
    latestDeliveryDate: "2026-07-14T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "171-3939494-9911569",
    buyerName: "Akram Shaik",
    buyerPhone: "8106508509",
    shipPhone: "8106508509",
    sku: "New LG Silicone Tube",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-13T18:30:00+00:00",
    latestDeliveryDate: "2026-07-14T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "402-8786848-6711521",
    buyerName: "ankita kulkarni",
    buyerPhone: "9791028844",
    shipPhone: "9791028844",
    sku: "Pipe-For-Sure Delight NXT RO+UV",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-13T18:30:00+00:00",
    latestDeliveryDate: "2026-07-14T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "404-1010282-0585128",
    buyerName: "Vilas",
    buyerPhone: "9579930820",
    shipPhone: "9579930820",
    sku: "Aquaguard LG spanner",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-11T18:30:00+00:00",
    latestDeliveryDate: "2026-07-12T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "406-1653985-2134767",
    buyerName: "Lalit Kumar Agarwal",
    buyerPhone: "9811907489",
    shipPhone: "9811907489",
    sku: "KENT-UTS-SILICONE-TUBE-5FT",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-13T18:30:00+00:00",
    latestDeliveryDate: "2026-07-14T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "407-6782869-7929954",
    buyerName: "Gyaneshwar.. kumar pathekar",
    buyerPhone: "9406567034",
    shipPhone: "9406567034",
    sku: "1-Pc-RO Spanner-Black",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-12T18:30:00+00:00",
    latestDeliveryDate: "2026-07-13T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "408-0344717-9712308",
    buyerName: "msparihar",
    buyerPhone: "9711952003",
    shipPhone: "7665007657",
    sku: "Aquaguard Sure Delight Silicone Tube",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-12T18:30:00+00:00",
    latestDeliveryDate: "2026-07-13T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "404-7835295-1719545",
    buyerName: "Shashank KV",
    buyerPhone: "9849777046",
    shipPhone: "9849777046",
    sku: "Pureit Wave Silicone Pipe",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-16T18:30:00+00:00",
    latestDeliveryDate: "2026-07-17T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "406-5743282-0913158",
    buyerName: "Abhilash",
    buyerPhone: "7204043456",
    shipPhone: "7204043456",
    sku: "Aquaguard UTS Silicone Tube",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-13T18:30:00+00:00",
    latestDeliveryDate: "2026-07-14T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "406-3379531-2236340",
    buyerName: "Subrata Kumar Dutta",
    buyerPhone: "9101499237",
    shipPhone: "9101499237",
    sku: "1-Pc-RO Spanner-Black",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-15T18:30:00+00:00",
    latestDeliveryDate: "2026-07-16T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "405-3604253-1044317",
    buyerName: "Sitangshu Paul",
    buyerPhone: "8135049051",
    shipPhone: "8135049051",
    sku: "Aquaguard-Copper-Superio-PVC-Pipe",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-16T18:30:00+00:00",
    latestDeliveryDate: "2026-07-17T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "171-7710880-8486729",
    buyerName: "Jayashree",
    buyerPhone: "9886730739",
    shipPhone: "9886730739",
    sku: "Mapp-Top-Mesh",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-13T18:30:00+00:00",
    latestDeliveryDate: "2026-07-14T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "402-8649047-4053902",
    buyerName: "Subhashish Aich",
    buyerPhone: "9741055569",
    shipPhone: "9741055569",
    sku: "Pipe-For-Sure Delight NXT RO+UV",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-10T18:30:00+00:00",
    latestDeliveryDate: "2026-07-11T18:29:59+00:00",
    customerReply: "",
    actions: ""
  },
  {
    orderId: "408-0278352-1262747",
    buyerName: "Monika maheshwari",
    buyerPhone: "9461110924",
    shipPhone: "9461110924",
    sku: "Pipe-For-Sure Delight NXT RO+UV",
    latestShipDate: "2026-07-09T18:29:59+00:00",
    earliestDeliveryDate: "2026-07-10T18:30:00+00:00",
    latestDeliveryDate: "2026-07-11T18:29:59+00:00",
    customerReply: "",
    actions: ""
  }
];

const importOrders = async () => {
  try {
    await connectDB();
    await syncModels();

    console.log('Disabling SQLite foreign key checks and clearing old test records...');
    await sequelize.query('PRAGMA foreign_keys = OFF;');
    await Order.destroy({ where: {}, truncate: false });
    await Customer.destroy({ where: {}, truncate: false });
    await sequelize.query('PRAGMA foreign_keys = ON;');

    console.log(`Processing ${orderRows.length} clean order entries...`);

    let createdCustomers = 0;
    let reusedCustomers = 0;
    let createdOrders = 0;

    for (const item of orderRows) {
      const isValidPhone = (p) => p && p !== '000-000-0000' && p.replace(/\D/g, '').length >= 8;
      const phone = isValidPhone(item.buyerPhone) ? item.buyerPhone : (isValidPhone(item.shipPhone) ? item.shipPhone : null);
      const whatsappNum = isValidPhone(item.shipPhone) ? item.shipPhone : (isValidPhone(item.buyerPhone) ? item.buyerPhone : null);

      let customer;
      if (phone) {
        let existingCustomer = await Customer.findOne({ where: { phone } });
        if (existingCustomer) {
          customer = existingCustomer;
          reusedCustomers++;
        } else {
          customer = await Customer.create({
            id: uuidv4(),
            name: item.buyerName,
            phone: phone,
            whatsapp_number: whatsappNum,
            source: 'amazon',
            status: 'active',
            lifecycle_stage: 'customer',
          });
          createdCustomers++;
        }
      } else {
        customer = await Customer.create({
          id: uuidv4(),
          name: item.buyerName,
          source: 'amazon',
          status: 'active',
          lifecycle_stage: 'customer',
        });
        createdCustomers++;
      }

      const safeDate = (dStr) => (dStr ? new Date(dStr) : null);
      const orderNum = `AMZ-${item.orderId}`;

      await Order.create({
        id: uuidv4(),
        order_number: orderNum,
        marketplace_order_id: item.orderId,
        marketplace: 'amazon',
        customer_id: customer.id,
        product_sku: item.sku,
        product_name: item.sku,
        quantity: 1,
        status: 'pending',
        flow_stage: 'ask_images',
        latest_ship_date: safeDate(item.latestShipDate),
        earliest_delivery_date: safeDate(item.earliestDeliveryDate),
        estimated_delivery_date: safeDate(item.latestDeliveryDate),
        customer_feedback: item.customerReply || null,
        internal_notes: item.actions || null,
        shipping_address: {
          ship_phone: item.shipPhone || null,
          buyer_phone: item.buyerPhone || null
        }
      });

      await customer.increment('total_orders');
      createdOrders++;
    }

    console.log('\n--- Clean Import Final Results ---');
    console.log(`✅ New Customers Created : ${createdCustomers}`);
    console.log(`🔄 Existing Customers Reused: ${reusedCustomers}`);
    console.log(`📦 Orders Created        : ${createdOrders}`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Error during order import:', err);
    process.exit(1);
  }
};

importOrders();
