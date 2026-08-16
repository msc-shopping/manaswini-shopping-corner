
/* ============================================================
   MSC V4 — COLLABORATION / SELLER / ADMIN EXTENSION
   Paste this block at the END of Code.gs.
   Then add the marked 2 lines to handleAdminRequest().
   ============================================================ */

/* ---------- PORTAL CONSTANTS ---------- */
const MSC_PORTAL = {
  SELLER_STATUS_PENDING: "Pending Review",
  SELLER_STATUS_APPROVED: "Approved",
  SELLER_STATUS_REJECTED: "Rejected",
  PRODUCT_PENDING: "Pending Review",
  PRODUCT_APPROVED: "Approved",
  PRODUCT_REJECTED: "Rejected",
  PRODUCT_PUBLISHED: "Published",
  DEFAULT_RETURN_DAYS: 0
};

/* ---------- SHEET SETUP ---------- */
function ensurePortalSheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1,1,1,headers.length).setValues([headers]);
  } else {
    const current = sh.getRange(1,1,1,Math.max(sh.getLastColumn(),1)).getValues()[0].map(String);
    headers.forEach(function(h) {
      if (current.indexOf(h) === -1) {
        sh.getRange(1,sh.getLastColumn()+1).setValue(h);
        current.push(h);
      }
    });
  }
  return sh;
}

function ensureSellersSheet_() {
  return ensurePortalSheet_("Sellers", [
    "SellerID","Email","FullName","BusinessName","Phone","WhatsApp",
    "City","State","Pincode","Category","ProductCategories","AboutBusiness",
    "Website","Instagram","ApplicationDate","Status","AdminNote",
    "ApprovedAt","UpdatedAt"
  ]);
}

function ensureSellerProductsSheet_() {
  return ensurePortalSheet_("SellerProducts", [
    "SubmissionID","SellerID","ProductID","ProductName","Category","Subcategory",
    "MRP","SuggestedPrice","ApprovedPrice","Discount","MOQ","Stock","Unit",
    "Description","ImageCount","SubmittedAt","Status","AdminNote","ReviewedAt",
    "PublishedAt"
  ]);
}

function ensurePayoutsSheet_() {
  return ensurePortalSheet_("SellerPayouts", [
    "PayoutID","SellerID","OrderID","ProductID","GrossAmount","PlatformFee",
    "SellerAmount","OrderDate","EligibleDate","Status","PaidDate","AdminNote"
  ]);
}

function ensurePortalSettings_() {
  const sh = ensurePortalSheet_("PortalSettings", ["Key","Value","UpdatedAt"]);
  const data = sh.getDataRange().getValues();
  const keys = {};
  for (let i=1;i<data.length;i++) keys[String(data[i][0]||"").trim()] = i+1;
  const defaults = {
    "Return Period Days": String(MSC_PORTAL.DEFAULT_RETURN_DAYS),
    "Platform Fee Percent": "0",
    "Seller Product Review Required": "YES"
  };
  Object.keys(defaults).forEach(function(k) {
    if (!keys[k]) sh.appendRow([k,defaults[k],Utilities.formatDate(new Date(),CONFIG.TIMEZONE,"yyyy-MM-dd HH:mm:ss")]);
  });
  return sh;
}

function getPortalSetting_(key, fallback) {
  const sh = ensurePortalSettings_();
  const data = sh.getDataRange().getValues();
  for (let i=1;i<data.length;i++) {
    if (String(data[i][0]||"").trim() === key) return data[i][1];
  }
  return fallback;
}

function portalNow_() {
  return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd HH:mm:ss");
}

/* ---------- SELLER APPLICATION ---------- */
function handleSellerRequest_(payload) {
  const action = String(payload.action || "").trim();
  if (action === "sellerApply") return sellerApply_(payload);
  if (action === "sellerStatus") return sellerStatus_(payload);
  if (action === "sellerGetProfile") return sellerGetProfile_(payload);
  if (action === "sellerGetProducts") return sellerGetProducts_(payload);
  if (action === "sellerSubmitProduct") return sellerSubmitProduct_(payload);
  if (action === "sellerGetOrders") return sellerGetOrders_(payload);
  if (action === "sellerGetPayouts") return sellerGetPayouts_(payload);
  throw new Error("Invalid seller action: " + action);
}

function sellerApply_(payload) {
  const f = payload.application || {};
  const email = String(f.email||"").trim().toLowerCase();
  const name = String(f.fullName||"").trim();
  const business = String(f.businessName||"").trim();
  const phone = String(f.phone||"").trim();
  if (!name || !business || !email || !phone) throw new Error("Name, business name, email and mobile number are required.");
  if (!isValidEmail(email)) throw new Error("Enter a valid email address.");
  const sh = ensureSellersSheet_();
  const data = sh.getDataRange().getValues(), idx=createHeaderIndex(data[0]);
  for (let r=1;r<data.length;r++) {
    if (String(data[r][idx.Email]||"").trim().toLowerCase()===email) {
      return {status:"success", sellerId:String(data[r][idx.SellerID]||""), applicationStatus:String(data[r][idx.Status]||"Pending Review"), message:"An application already exists for this email."};
    }
  }
  const sellerId = "SEL-" + Utilities.getUuid().replace(/-/g,"").slice(0,10).toUpperCase();
  sh.appendRow(createRowFromHeaders(data[0], {
    SellerID:sellerId, Email:email, FullName:name, BusinessName:business,
    Phone:phone, WhatsApp:String(f.whatsapp||phone), City:String(f.city||""),
    State:String(f.state||""), Pincode:String(f.pincode||""), Category:String(f.category||""),
    ProductCategories:String(f.productCategories||""), AboutBusiness:String(f.aboutBusiness||""),
    Website:String(f.website||""), Instagram:String(f.instagram||""),
    ApplicationDate:portalNow_(), Status:MSC_PORTAL.SELLER_STATUS_PENDING,
    AdminNote:"", ApprovedAt:"", UpdatedAt:portalNow_()
  }));
  return {status:"success", sellerId:sellerId, applicationStatus:MSC_PORTAL.SELLER_STATUS_PENDING, message:"Application submitted for review."};
}

function sellerStatus_(payload) {
  const email = String(payload.email||"").trim().toLowerCase();
  const sellerId = String(payload.sellerId||"").trim();
  const sh = ensureSellersSheet_(), data=sh.getDataRange().getValues(), idx=createHeaderIndex(data[0]);
  for (let r=1;r<data.length;r++) {
    if ((sellerId && String(data[r][idx.SellerID]||"").trim()===sellerId) ||
        (email && String(data[r][idx.Email]||"").trim().toLowerCase()===email)) {
      return {status:"success", seller:{
        sellerId:data[r][idx.SellerID], email:data[r][idx.Email], fullName:data[r][idx.FullName],
        businessName:data[r][idx.BusinessName], applicationStatus:data[r][idx.Status],
        adminNote:data[r][idx.AdminNote], approvedAt:data[r][idx.ApprovedAt]
      }};
    }
  }
  return {status:"success", seller:null};
}

function sellerByEmail_(email) {
  const sh=ensureSellersSheet_(), data=sh.getDataRange().getValues(), idx=createHeaderIndex(data[0]);
  const target=String(email||"").trim().toLowerCase();
  for(let r=1;r<data.length;r++) if(String(data[r][idx.Email]||"").trim().toLowerCase()===target) {
    const o={}; data[0].forEach(function(h,i){o[h]=data[r][i];}); return o;
  }
  return null;
}

function requireApprovedSeller_(idToken) {
  const info=verifyGoogleIdToken(String(idToken||""));
  const seller=sellerByEmail_(info.email);
  if(!seller) throw new Error("No seller application was found for this Google account.");
  if(String(seller.Status)!==MSC_PORTAL.SELLER_STATUS_APPROVED) throw new Error("Seller account is not approved yet. Current status: "+seller.Status);
  return {info:info,seller:seller};
}

function sellerGetProfile_(payload) {
  const x=requireApprovedSeller_(payload.idToken);
  return {status:"success",seller:x.seller};
}

/* ---------- SELLER PRODUCT SUBMISSION ---------- */
function sellerSubmitProduct_(payload) {
  const x=requireApprovedSeller_(payload.idToken);
  const f=payload.product||{};
  const name=String(f.productName||"").trim();
  const category=String(f.category||"").trim();
  const subcategory=String(f.subcategory||"").trim();
  const mrp=Number(f.mrp), suggested=Number(f.suggestedPrice);
  const moq=Math.max(1,Number(f.moq||1)), stock=Math.max(0,Number(f.stock||0));
  if(!name || !category) throw new Error("Product name and category are required.");
  if(!Number.isFinite(mrp) || mrp<0) throw new Error("Enter a valid MRP.");
  if(!Number.isFinite(suggested) || suggested<0) throw new Error("Enter a valid suggested selling price.");
  if(mrp>0 && suggested>mrp) throw new Error("Suggested price cannot exceed MRP.");
  if(!Number.isInteger(moq) || !Number.isInteger(stock)) throw new Error("MOQ and stock must be whole numbers.");

  const sh=ensureSellerProductsSheet_(), data=sh.getDataRange().getValues(), headers=data[0];
  const submissionId="SUB-"+Utilities.getUuid().replace(/-/g,"").slice(0,12).toUpperCase();
  const seller=x.seller;
  const imageCount=saveSellerProductImages_(submissionId,payload.images||[]);
  sh.appendRow(createRowFromHeaders(headers,{
    SubmissionID:submissionId,SellerID:seller.SellerID,ProductID:"",
    ProductName:name,Category:category,Subcategory:subcategory,MRP:roundMoney(mrp),
    SuggestedPrice:roundMoney(suggested),ApprovedPrice:"",Discount:Number(f.discount||0),
    MOQ:moq,Stock:stock,Unit:String(f.unit||"Piece"),Description:String(f.description||""),
    ImageCount:imageCount,SubmittedAt:portalNow_(),Status:MSC_PORTAL.PRODUCT_PENDING,
    AdminNote:"",ReviewedAt:"",PublishedAt:""
  }));
  return {status:"success",submissionId:submissionId,statusText:MSC_PORTAL.PRODUCT_PENDING,message:"Product submitted for MSC Admin review."};
}

function saveSellerProductImages_(submissionId,images) {
  if(!Array.isArray(images)) return 0;
  if(images.length>8) throw new Error("Maximum 8 images per submission.");
  const folder=DriveApp.getFolderById(PRODUCT_IMAGE_FOLDER_ID);
  let count=0;
  const sh=ensurePortalSheet_("SellerProductImages",["SubmissionID","SortOrder","FileName","DriveFileID","ImageURL"]);
  images.forEach(function(item,i){
    const dataUrl=String(item.dataUrl||""), match=dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if(!match) throw new Error("Invalid image data.");
    const mime=match[1].toLowerCase();
    if(["image/jpeg","image/png","image/webp"].indexOf(mime)===-1) throw new Error("Only JPG, PNG and WebP images are allowed.");
    const ext=mime==="image/png"?"png":mime==="image/webp"?"webp":"jpg";
    const fileName=submissionId+"-"+String(i+1).padStart(2,"0")+"."+ext;
    const blob=Utilities.newBlob(Utilities.base64Decode(match[2]),mime,fileName);
    const file=folder.createFile(blob);
    try{file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);}catch(ignore){}
    const url="https://drive.usercontent.google.com/download?id="+encodeURIComponent(file.getId())+"&export=view";
    sh.appendRow([submissionId,i+1,fileName,file.getId(),url]); count++;
  });
  return count;
}

function sellerGetProducts_(payload) {
  const x=requireApprovedSeller_(payload.idToken);
  const sh=ensureSellerProductsSheet_(), data=sh.getDataRange().getValues();
  if(data.length<2) return {status:"success",products:[]};
  const idx=createHeaderIndex(data[0]), out=[];
  for(let r=1;r<data.length;r++) if(String(data[r][idx.SellerID]||"")===String(x.seller.SellerID)) {
    const o={}; data[0].forEach(function(h,i){o[h]=data[r][i];}); out.push(o);
  }
  return {status:"success",products:out.reverse()};
}

function sellerGetOrders_(payload) {
  const x=requireApprovedSeller_(payload.idToken);
  const sellerId=String(x.seller.SellerID);
  const ps=getRequiredSheet(SpreadsheetApp.getActiveSpreadsheet(),"Products");
  const pd=ps.getDataRange().getValues(); if(pd.length<2) return {status:"success",orders:[]};
  const pi=createHeaderIndex(pd[0]), productIds={};
  for(let r=1;r<pd.length;r++) if(String(pd[r][pi.SellerID]||"")===sellerId) productIds[String(pd[r][pi.ProductID]||"")]=true;
  const is=getRequiredSheet(SpreadsheetApp.getActiveSpreadsheet(),"OrderItems");
  const od=getRequiredSheet(SpreadsheetApp.getActiveSpreadsheet(),"Orders");
  const idata=is.getDataRange().getValues(), odata=od.getDataRange().getValues();
  if(idata.length<2||odata.length<2) return {status:"success",orders:[]};
  const ii=createHeaderIndex(idata[0]), oi=createHeaderIndex(odata[0]), orders={};
  for(let r=1;r<idata.length;r++){
    const pid=String(idata[r][ii.ProductID]||""); if(!productIds[pid]) continue;
    const oid=String(idata[r][ii.OrderID]||""); if(!oid) continue;
    if(!orders[oid]) orders[oid]={orderId:oid,items:[],sellerTotal:0};
    const qty=Number(idata[r][ii.Quantity]||0), line=Number(idata[r][ii.LineTotal]||0);
    orders[oid].items.push({productId:pid,productName:idata[r][ii.ProductName],quantity:qty,lineTotal:line});
    orders[oid].sellerTotal+=line;
  }
  Object.keys(orders).forEach(function(oid){
    for(let r=1;r<odata.length;r++) if(String(odata[r][oi.OrderID]||"")===oid){
      orders[oid].date=odata[r][oi.Timestamp]; orders[oid].status=odata[r][oi.OrderStatus];
      orders[oid].paymentStatus=odata[r][oi.PaymentStatus]; break;
    }
  });
  return {status:"success",orders:Object.keys(orders).map(function(k){return orders[k];}).reverse()};
}

function sellerGetPayouts_(payload) {
  const x=requireApprovedSeller_(payload.idToken), sh=ensurePayoutsSheet_(), data=sh.getDataRange().getValues();
  if(data.length<2) return {status:"success",payouts:[]};
  const idx=createHeaderIndex(data[0]), out=[];
  for(let r=1;r<data.length;r++) if(String(data[r][idx.SellerID]||"")===String(x.seller.SellerID)){
    const o={}; data[0].forEach(function(h,i){o[h]=data[r][i];}); out.push(o);
  }
  return {status:"success",payouts:out.reverse()};
}

/* ---------- ADMIN SELLER / PRODUCT REVIEW ---------- */
function adminPortalRequest_(payload) {
  const action=String(payload.action||"").trim();
  requireAdmin_(payload.idToken);
  if(action==="adminGetSellers") return adminGetSellers_();
  if(action==="adminReviewSeller") return adminReviewSeller_(payload);
  if(action==="adminGetSellerProducts") return adminGetSellerProducts_();
  if(action==="adminReviewSellerProduct") return adminReviewSellerProduct_(payload);
  if(action==="adminGetPayouts") return adminGetAllPayouts_();
  if(action==="adminGetPortalSettings") return adminGetPortalSettings_();
  if(action==="adminSavePortalSettings") return adminSavePortalSettings_(payload);
  throw new Error("Invalid portal admin action: "+action);
}

function adminGetSellers_() {
  const sh=ensureSellersSheet_(), data=sh.getDataRange().getValues(), out=[];
  if(data.length<2) return {status:"success",sellers:[]};
  data.slice(1).forEach(function(row){const o={};data[0].forEach(function(h,i){o[h]=row[i];});out.push(o);});
  return {status:"success",sellers:out.reverse()};
}

function adminReviewSeller_(payload) {
  const sellerId=String(payload.sellerId||"").trim(), decision=String(payload.decision||"").trim();
  if(["Approved","Rejected","Pending Review"].indexOf(decision)<0) throw new Error("Invalid seller decision.");
  const sh=ensureSellersSheet_(), data=sh.getDataRange().getValues(), idx=createHeaderIndex(data[0]);
  for(let r=1;r<data.length;r++) if(String(data[r][idx.SellerID]||"")===sellerId){
    sh.getRange(r+1,idx.Status+1).setValue(decision);
    sh.getRange(r+1,idx.AdminNote+1).setValue(String(payload.note||""));
    sh.getRange(r+1,idx.UpdatedAt+1).setValue(portalNow_());
    if(decision==="Approved") sh.getRange(r+1,idx.ApprovedAt+1).setValue(portalNow_());
    return {status:"success",message:"Seller status updated.",sellerId:sellerId,status:decision};
  }
  throw new Error("Seller not found.");
}

function adminGetSellerProducts_() {
  const sh=ensureSellerProductsSheet_(), data=sh.getDataRange().getValues(), out=[];
  if(data.length<2) return {status:"success",products:[]};
  data.slice(1).forEach(function(row){const o={};data[0].forEach(function(h,i){o[h]=row[i];});out.push(o);});
  return {status:"success",products:out.reverse()};
}

function adminReviewSellerProduct_(payload) {
  const submissionId=String(payload.submissionId||"").trim();
  const decision=String(payload.decision||"").trim();
  if(["Approved","Rejected"].indexOf(decision)<0) throw new Error("Decision must be Approved or Rejected.");
  const sh=ensureSellerProductsSheet_(), data=sh.getDataRange().getValues(), idx=createHeaderIndex(data[0]);
  for(let r=1;r<data.length;r++) if(String(data[r][idx.SubmissionID]||"")===submissionId){
    const approvedPrice=Number(payload.approvedPrice);
    if(decision==="Approved" && (!Number.isFinite(approvedPrice)||approvedPrice<0)) throw new Error("Admin must enter an approved selling price.");
    sh.getRange(r+1,idx.Status+1).setValue(decision);
    sh.getRange(r+1,idx.AdminNote+1).setValue(String(payload.note||""));
    if(decision==="Approved") {
      sh.getRange(r+1,idx.ApprovedPrice+1).setValue(roundMoney(approvedPrice));
      sh.getRange(r+1,idx.ReviewedAt+1).setValue(portalNow_());
      publishSellerProduct_(data[r], idx, approvedPrice);
    } else {
      sh.getRange(r+1,idx.ReviewedAt+1).setValue(portalNow_());
    }
    return {status:"success",message:"Product review completed.",submissionId:submissionId,status:decision};
  }
  throw new Error("Submission not found.");
}

function publishSellerProduct_(row, idx, approvedPrice) {
  const setup=ensureProductColumns_(), sheet=setup.sheet, headers=setup.headers;
  const existingId=String(row[idx.ProductID]||"").trim();
  const productId=existingId || nextProductId_();
  const values={
    ProductID:productId,ProductName:row[idx.ProductName],Category:row[idx.Category],
    Subcategory:row[idx.Subcategory],MRP:row[idx.MRP],Price:approvedPrice,
    Discount:row[idx.Discount],MOQ:row[idx.MOQ],Stock:row[idx.Stock],Unit:row[idx.Unit],
    ShippingCharge:"",FreeShipping:"",Description:row[idx.Description],Active:true,
    SellerID:row[idx.SellerID],PublicationStatus:"Published"
  };
  if(existingId){
    const pdata=sheet.getDataRange().getValues(), pidx=createHeaderIndex(pdata[0]);
    for(let r=1;r<pdata.length;r++) if(String(pdata[r][pidx.ProductID]||"")===productId){
      const rr=createRowFromHeaders(headers,values); sheet.getRange(r+1,1,1,headers.length).setValues([rr]); return;
    }
  }
  sheet.appendRow(createRowFromHeaders(headers,values));
  copySellerImagesToProductImages_(String(row[idx.SubmissionID]),productId);
}

function copySellerImagesToProductImages_(submissionId,productId) {
  const ss=SpreadsheetApp.getActiveSpreadsheet(), src=ensurePortalSheet_("SellerProductImages",["SubmissionID","SortOrder","FileName","DriveFileID","ImageURL"]);
  const dst=ss.getSheetByName("ProductImages") || ss.insertSheet("ProductImages");
  if(dst.getLastRow()===0) dst.getRange(1,1,1,6).setValues([["ProductID","ImageURL","SortOrder","IsPrimary","FileName","DriveFileID"]]);
  const data=src.getDataRange().getValues(), rows=[];
  for(let r=1;r<data.length;r++) if(String(data[r][0]||"")===submissionId){
    rows.push([productId,data[r][4],data[r][1],Number(data[r][1])===1,data[r][2],data[r][3]]);
  }
  if(rows.length) dst.getRange(dst.getLastRow()+1,1,rows.length,6).setValues(rows);
}

function adminGetAllPayouts_() {
  return {status:"success",payouts:ensurePayoutsSheet_().getDataRange().getValues()};
}

function adminGetPortalSettings_() {
  const sh=ensurePortalSettings_(), data=sh.getDataRange().getValues(), out={};
  for(let r=1;r<data.length;r++) out[String(data[r][0]||"")]=data[r][1];
  return {status:"success",settings:out};
}

function adminSavePortalSettings_(payload) {
  const sh=ensurePortalSettings_(), data=sh.getDataRange().getValues(), idx=createHeaderIndex(data[0]);
  const settings=payload.settings||{};
  Object.keys(settings).forEach(function(key){
    let found=-1;
    for(let r=1;r<data.length;r++) if(String(data[r][idx.Key]||"")===key){found=r+1;break;}
    if(found>0){sh.getRange(found,idx.Value+1).setValue(settings[key]);sh.getRange(found,idx.UpdatedAt+1).setValue(portalNow_());}
    else sh.appendRow([key,settings[key],portalNow_()]);
  });
  return {status:"success",message:"Portal settings saved."};
}

/* ADD THESE TWO LINES INSIDE the existing handleAdminRequest(payload),
   immediately before: throw new Error("Invalid admin action: " + action); */

if (action.indexOf("admin") === 0 &&
    ["adminGetSellers","adminReviewSeller","adminGetSellerProducts",
     "adminReviewSellerProduct","adminGetPayouts","adminGetPortalSettings",
     "adminSavePortalSettings"].indexOf(action) >= 0) {
  return adminPortalRequest_(payload);
}

/* ALSO ADD THIS BEFORE the existing order-processing fallback in doPost(e):
   if (String(accountPayload.action || "").indexOf("seller") === 0) {
     return jsonResponse(handleSellerRequest_(accountPayload));
   }
*/
