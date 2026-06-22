# ContentForge Pricing Model
**Based on Actual Generation & Credits Burned**

*Model: Customer generates content multiple times (iterations/revisions), we charge per final output unit. All API calls count toward credits — whether draft 1 or draft 10.*

---

## 💡 PRICING PRINCIPLE

- **Image-Based:** ₹X per image generated (1 final image, regardless of how many were iterated)
- **Video:** ₹Y per minute of video generated (1 final minute, regardless of drafts)
- **E-Learning:** ₹Z per topic/module generated (1 final topic, regardless of revisions)

**Credits burned include:** All Claude calls, all image generations, all TTS, all video generation — it doesn't matter if it took 10 tries to get the perfect output.

---

## 📊 PRICING PER GENERATION UNIT

### IMAGE-BASED (Per Generated Image)

**Production Cost per Image:**
| Component | Rate | Cost |
|-----------|------|------|
| Claude API (scripting + narration) | 500 tokens × ₹0.083/1K | ₹0.042 |
| BFL Flux 2 Image | 1 image × ₹4.57/image | ₹4.57 |
| **Total Cost per Image** | | **₹4.612** |
| **Selling Price (50% margin)** | Cost × 2 | **₹9.22** |

**Bulk Pricing:**
- 1-10 images: ₹9.22/image
- 11-50 images: ₹8.75/image (5% off)
- 51-100 images: ₹8.28/image (10% off)
- 100+ images: ₹7.81/image (15% off)

**Example Course:**
- 10 final images = 10 × ₹9.22 = **₹92.20**
- (Customer may have generated 50 images to get these 10, we charge for 10 outputs)

---

### VIDEO LEARNING (Per Generated Minute)

**Production Cost per Minute:**
| Component | Rate | Cost |
|-----------|------|------|
| Claude API (scripts) | 2K tokens × ₹0.083/1K | ₹0.166 |
| HeyGen Video | 1 min × ₹41.50/min | ₹41.50 |
| ElevenLabs Narration | 300 chars × ₹0.025/char | ₹0.0075 |
| **Total Cost per Minute** | | **₹41.673** |
| **Selling Price (50% margin)** | Cost × 2 | **₹83.35** |

**Bulk Pricing:**
- 1-5 min: ₹83.35/min
- 6-15 min: ₹79.18/min (5% off)
- 16-30 min: ₹75.02/min (10% off)
- 30+ min: ₹70.85/min (15% off)

**Example Course:**
- 8 final minutes = 8 × ₹83.35 = **₹666.80**
- (Customer may have generated 20 video attempts, we charge for 8 final outputs)

---

### E-LEARNING (Per Generated Topic)

**Production Cost per Topic:**
| Component | Rate | Cost |
|-----------|------|------|
| Claude API (full content + Q&A) | 10K tokens × ₹0.083/1K | ₹0.83 |
| ElevenLabs Narration (optional) | 2K chars × ₹0.025/char | ₹0.05 |
| **Total Cost per Topic** | | **₹0.88** |
| **Selling Price (50% margin)** | Cost × 2 | **₹1.76** |

**Bulk Pricing:**
- 1-5 topics: ₹1.76/topic
- 6-15 topics: ₹1.67/topic (5% off)
- 16-30 topics: ₹1.58/topic (10% off)
- 30+ topics: ₹1.50/topic (15% off)

**Example Course:**
- 6 final topics = 6 × ₹1.76 = **₹10.56**
- (Customer may have generated 20 topic drafts, we charge for 6 final outputs)

---

## 🎯 COMPLETE COURSE EXAMPLES

### Scenario: Customer Creates 5-Topic Course

#### IMAGE-BASED (5 topics × 2 final images each = 10 images)
- 10 images × ₹9.22 = **₹92.20**

#### VIDEO (5 topics × 1.5 min final video = 7.5 minutes)
- 7.5 min × ₹83.35 = **₹625.13**

#### E-LEARNING (5 topics)
- 5 topics × ₹1.76 = **₹8.80**

---

## 📈 PRICING SUMMARY TABLE

| Course Type | Unit | Cost | Selling Price | Notes |
|-----------|------|------|---|---|
| **Image** | 1 image | ₹4.61 | ₹9.22 | Per generated image |
| **Video** | 1 minute | ₹41.67 | ₹83.35 | Per generated minute |
| **E-Learning** | 1 topic | ₹0.88 | ₹1.76 | Per generated topic |

---

## 💰 TYPICAL COURSE PRICING

| Format | 5-Topic Course | Price/Topic | Price/Min |
|--------|---|---|---|
| **E-Learning** | ₹8.80 | ₹1.76 | N/A |
| **Image-Based** | ₹92.20* | ₹18.44 | N/A |
| **Video** | ₹625.13* | ₹125.03 | ₹83.35 |

*Assuming 2 images per topic for image-based, 1.5 min per topic for video

---

## 🔄 ITERATIONS & CREDIT BURN

**The customer's workflow:**
1. Request: "Generate 5-topic course in image-based format"
2. System generates 50 images (10 per topic as drafts)
3. Customer selects best 10 (2 per topic)
4. **We charge for:** 10 final images = ₹92.20
5. **We burned credits for:** 50 images = ₹231 (behind the scenes)

**Our margin:**
- We charged: ₹92.20 (selling price)
- We burned: ₹46.12 (cost of final 10)
- Gross Margin: ₹46.08 (50% of selling price)
- BUT we burned ₹231 total on all 50 attempts
- **Net margin: Negative if iterations are high**

---

## ⚠️ ITERATION MANAGEMENT STRATEGY

To protect margins while allowing customer iteration:

### Option A: Per-Attempt Charging
- Charge for **each attempt**, not just final output
- Customer pays for quality/iteration cost
- More transparent but higher customer cost

### Option B: Iteration Limits (Recommended)
- E-Learning: 5 free attempts, then ₹0.50/additional
- Image-Based: 3 free attempts, then ₹2.50/additional
- Video: 2 free attempts, then ₹25/additional

### Option C: Premium Generation Mode
- Standard: 1 iteration included, then ₹X per additional
- Premium (+50% markup): Unlimited iterations
- Example: Standard image = ₹9.22, Premium = ₹13.83

---

## 📋 CREDITS CONSUMPTION (Full Transparency)

When customer generates 5-topic image-based course with iterations:

| Activity | Units | Rate | Credits |
|----------|-------|------|---------|
| Claude (scripting × 50 attempts) | 25K tokens | ₹0.083/1K | ₹2.08 |
| BFL Images (50 attempts) | 50 images | ₹4.57/img | ₹228.50 |
| ElevenLabs (50 narrations) | 100K chars | ₹0.025/char | ₹2.50 |
| **Total Credits Burned** | | | **₹233.08** |
| **Customer Pays** | 10 images | | **₹92.20** |
| **ContentForge Cost** | Per 10 images | | **₹46.12** |

*This shows how iteration costs us more but customer pays same (if no iteration pricing)*

---

## ✅ RECOMMENDED MODEL

**Simple, transparent, margin-protected:**

1. **Base Price per Unit:**
   - Image: ₹9.22
   - Video: ₹83.35
   - E-Learning: ₹1.76

2. **Iteration Policy:**
   - 3 free regenerations per unit
   - After 3: ₹2.50 per image, ₹25 per video minute, ₹0.30 per e-learning topic

3. **Bulk Discounts (on final output):**
   - 11-50 units: 5% off
   - 51-100 units: 10% off
   - 100+: 15% off

4. **Customer Visibility:**
   - Show: "You've used 2 of 3 free regenerations. Next attempt: +₹2.50"
   - Transparency builds trust
   - Encourages quality/prompt refinement

---

**Currency:** INR  
**Margin Model:** 50% Gross (Price = Cost × 2)  
**Last Updated:** 2026-06-22
