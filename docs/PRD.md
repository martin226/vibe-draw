# Product Requirements Document (PRD)
## Vibe Draw - AI-Powered Sketch to 3D Platform

**Version**: 1.0
**Date**: December 2024
**Status**: Draft

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Product Vision](#product-vision)
3. [Current State Analysis](#current-state-analysis)
4. [Core Features](#core-features)
5. [Technical Architecture](#technical-architecture)
6. [AI Integration Strategy for Startup](#ai-integration-strategy-for-startup)
7. [Market Analysis](#market-analysis)
8. [Roadmap](#roadmap)
9. [Success Metrics](#success-metrics)
10. [Risks & Mitigations](#risks--mitigations)

---

## 1. Executive Summary

**Vibe Draw** is an innovative AI-powered platform that transforms rough 2D sketches into stunning 3D models and immersive worlds. The application democratizes 3D content creation by eliminating the need for technical expertise in 3D modeling software.

### Value Proposition
> "Turn your roughest sketches into stunning 3D worlds by vibe drawing"

**Target Users**:
- Game designers & indie developers
- Architects & interior designers
- Content creators & educators
- Hobbyists & creative enthusiasts
- Children & students learning 3D concepts

**Key Differentiator**: Multi-modal AI pipeline combining sketch enhancement, code generation, and 3D transformation in a seamless creative workflow.

---

## 2. Product Vision

### Mission Statement
To make 3D content creation accessible to everyone, regardless of technical skill or artistic ability, by leveraging cutting-edge AI to bridge the gap between imagination and creation.

### Long-term Vision
Become the go-to platform for rapid 3D prototyping and creative expression, powering everything from indie games to architectural visualizations to educational content.

### Core Principles
1. **Simplicity First** - Complex technology, simple interface
2. **Creative Freedom** - Support any creative style or vision
3. **Instant Gratification** - Real-time results, not waiting hours
4. **Interoperability** - Export to industry-standard formats
5. **AI as Assistant** - AI enhances, humans direct

---

## 3. Current State Analysis

### Existing Features

| Feature | Technology | Status |
|---------|------------|--------|
| 2D Drawing Canvas | TLDraw 2.0 | ✅ Complete |
| Sketch Enhancement | Gemini 2.0 Flash | ✅ Complete |
| 3D Model Generation | Claude 3.7 Sonnet | ✅ Complete |
| 3D Model Editing | Claude 3.7 Sonnet | ✅ Complete |
| Image-to-3D | Trellis API | ✅ Complete |
| 3D World Builder | Three.js/R3F | ✅ Complete |
| First-Person Navigation | Custom Controller | ✅ Complete |
| glTF Export | GLTFExporter | ✅ Complete |
| Real-time Streaming | SSE + Redis | ✅ Complete |

### Current Technical Stack

**Frontend**:
- Next.js 14 + React 18
- Three.js + React Three Fiber
- TLDraw (drawing canvas)
- Zustand (state management)
- TypeScript

**Backend**:
- FastAPI (Python)
- Celery + Redis (async processing)
- Docker Compose (orchestration)

**AI Models**:
- Anthropic Claude 3.7 Sonnet (3D code generation)
- Google Gemini 2.0 Flash (image enhancement)
- Cerebras LLaMA 3.3 (code parsing)
- Trellis/PiAPI (image-to-3D)

### Current User Flow
```
Draw Sketch → (Optional) Enhance → Generate 3D → Add to World → Export
```

---

## 4. Core Features

### 4.1 2D Drawing Canvas
**Description**: Professional-grade drawing interface powered by TLDraw.

**Capabilities**:
- Freehand drawing with stylus/mouse support
- Shape tools (rectangles, ellipses, polygons)
- Text annotations
- Layer management
- Selection and grouping
- Custom styling (colors, strokes, fills)

### 4.2 AI Drawing Enhancement
**Description**: Transform rough sketches into polished illustrations.

**User Story**: As a user, I want to draw a rough sketch and have AI refine it while maintaining my artistic intent.

**Technical Flow**:
```
Canvas Selection → PNG Export → Gemini API → Enhanced Image → Canvas Update
```

### 4.3 Sketch-to-3D Generation
**Description**: Convert 2D drawings into interactive 3D models using AI.

**User Story**: As a user, I want to draw a simple sketch and get a 3D model that I can rotate, scale, and use in my projects.

**Technical Flow**:
```
Canvas Selection → PNG + Context → Claude API → Three.js Code → 3D Object
```

**AI Prompt Engineering**:
- Analyzes sketch composition and colors
- Determines appropriate 3D geometries
- Generates materials matching sketch style
- Adds appropriate lighting and shadows
- Creates subtle animations where appropriate

### 4.4 3D Model Editing
**Description**: Modify existing 3D models using sketches or text prompts.

**User Story**: As a user, I want to iterate on my 3D models by drawing changes or describing modifications.

**Capabilities**:
- Visual edits (draw on top of existing models)
- Text-based modifications ("make it taller", "add windows")
- Style transfers
- Color adjustments

### 4.5 3D World Builder
**Description**: Interactive 3D environment for assembling multiple objects.

**Capabilities**:
- First-person camera navigation
- Object placement with transform controls
- Translate, rotate, scale gizmos
- Object selection and highlighting
- Infinite grid ground plane
- Optional environmental effects (ocean)

### 4.6 Export System
**Description**: Export 3D worlds in industry-standard formats.

**Supported Formats**:
- glTF 2.0 (JSON)
- GLB (binary)

**Compatibility**:
- Blender
- Unity
- Unreal Engine
- Babylon.js
- Three.js projects
- AR/VR platforms

---

## 5. Technical Architecture

### 5.1 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   TLDraw    │  │  React 3F   │  │      Zustand Store      │  │
│  │   Canvas    │◄─┤   Canvas    │◄─┤  (Objects, UI, Tabs)    │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                │                      │                │
│         └────────────────┴──────────────────────┘                │
│                          │                                       │
└──────────────────────────┼───────────────────────────────────────┘
                           │ REST + SSE
┌──────────────────────────┼───────────────────────────────────────┐
│                    BACKEND API                                   │
│  ┌─────────────┐  ┌──────┴──────┐  ┌─────────────────────────┐  │
│  │   FastAPI   │  │    Redis    │  │    Celery Workers       │  │
│  │   Routes    │◄─┤   Pub/Sub   │◄─┤  (AI Task Processing)   │  │
│  └─────────────┘  └─────────────┘  └───────────┬─────────────┘  │
│                                                 │                │
└─────────────────────────────────────────────────┼────────────────┘
                                                  │
┌─────────────────────────────────────────────────┼────────────────┐
│                    AI SERVICES                  │                │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌┴──────────┐     │
│  │  Claude   │  │  Gemini   │  │  Cerebras │  │  Trellis  │     │
│  │  3.7      │  │  2.0      │  │  LLaMA    │  │  API      │     │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘     │
└──────────────────────────────────────────────────────────────────┘
```

### 5.2 Data Flow

**3D Generation Flow**:
1. User draws on TLDraw canvas
2. Selection converted to PNG
3. Frontend calls `/api/queue/3d`
4. Backend creates task, returns task ID
5. Celery worker processes task
6. Claude generates Three.js code
7. Progress streamed via SSE
8. Frontend executes code, renders 3D object
9. Object stored in Zustand store

### 5.3 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/queue/{type}` | POST | Queue AI task (3d, edit, image) |
| `/api/subscribe/{task_id}` | GET | SSE stream for progress |
| `/api/task/{task_id}` | GET | Get task status/result |
| `/api/cerebras/parse` | POST | Parse/clean generated code |
| `/api/trellis/task` | POST | Create image-to-3D task |
| `/api/trellis/task/ws/{id}` | WS | Monitor Trellis progress |

---

## 6. AI Integration Strategy for Startup

### 6.1 Phase 1: Enhanced Core AI Features

#### 6.1.1 Multi-View Generation
**Description**: Generate multiple views of an object from a single sketch.

**Implementation**:
- Use Claude to generate front, side, top views
- Combine views for more accurate 3D reconstruction
- Allow user to refine individual views

**Business Value**: Higher quality outputs increase conversion and retention.

#### 6.1.2 Style Transfer System
**Description**: Apply artistic styles to 3D models.

**Styles**:
- Low-poly
- Realistic PBR
- Cartoon/Toon shading
- Voxel art
- Pixel art 3D
- Claymation

**Implementation**:
- Fine-tuned prompts for each style
- Material presets
- Post-processing effects

#### 6.1.3 Smart Object Recognition
**Description**: AI identifies what user is drawing and suggests improvements.

**Features**:
- Real-time sketch classification
- Context-aware suggestions
- Auto-completion of common objects
- "Did you mean...?" suggestions

### 6.2 Phase 2: Advanced AI Capabilities

#### 6.2.1 Text-to-3D Direct Generation
**Description**: Generate 3D models from text descriptions alone.

**User Story**: As a user, I want to type "a medieval castle with towers" and get a 3D model.

**Implementation**:
```
Text Prompt → Claude (scene planning) → Claude (3D code) → Three.js Object
```

**Example Prompts**:
- "A cozy coffee shop interior"
- "A spaceship control room"
- "A cartoon dog character"

#### 6.2.2 AI Scene Composer
**Description**: Automatically arrange multiple objects into coherent scenes.

**Features**:
- Intelligent object placement
- Scale normalization
- Lighting suggestions
- Composition rules (rule of thirds, golden ratio)

**Implementation**:
- Claude analyzes objects and suggests layouts
- Physics-based placement validation
- User can accept/modify suggestions

#### 6.2.3 Procedural Generation
**Description**: AI-powered procedural content generation.

**Capabilities**:
- Terrain generation from rough sketches
- Building facades from simple shapes
- Vegetation and foliage systems
- Crowd/population placement

#### 6.2.4 Animation Generation
**Description**: Generate animations for 3D models.

**Types**:
- Idle animations
- Walk cycles
- Simple interactions
- Physics-based movements

**Implementation**:
- Claude generates keyframe data
- Morph target animations
- Skeletal rigging for characters

### 6.3 Phase 3: Collaborative & Social AI

#### 6.3.1 AI Creative Assistant
**Description**: Interactive AI assistant for creative guidance.

**Capabilities**:
- Suggest creative directions
- Answer "how do I make..." questions
- Provide design feedback
- Offer alternatives and variations

**Implementation**:
- Conversational interface
- Context-aware suggestions
- Memory of user preferences

#### 6.3.2 Collaborative Generation
**Description**: Multiple users can collaborate on AI-generated content.

**Features**:
- Real-time collaborative sketching
- Shared 3D world editing
- AI mediates style conflicts
- Version history and branching

#### 6.3.3 Community-Trained Models
**Description**: Fine-tune AI on community creations.

**Implementation**:
- User consent for training
- Style preservation models
- Community voting on outputs
- Creator attribution

### 6.4 Phase 4: Enterprise & Professional AI

#### 6.4.1 Brand-Consistent Generation
**Description**: AI generates content matching brand guidelines.

**Features**:
- Upload brand style guide
- Color palette enforcement
- Typography integration
- Asset library integration

#### 6.4.2 CAD Integration
**Description**: Generate technical 3D models for engineering.

**Capabilities**:
- Dimension-accurate generation
- Standard part libraries
- Assembly visualization
- Technical drawing output

#### 6.4.3 AI-Powered QA
**Description**: Automated quality checks on generated content.

**Checks**:
- Mesh integrity
- Texture quality
- Performance optimization
- Accessibility compliance

---

## 7. Market Analysis

### 7.1 Target Market Segments

#### Primary: Creative Professionals
- **Size**: ~10M globally
- **Need**: Rapid prototyping, concept visualization
- **Willingness to Pay**: High ($30-100/month)

#### Secondary: Game Developers
- **Size**: ~5M globally
- **Need**: Asset creation, level design
- **Willingness to Pay**: Medium ($20-50/month)

#### Tertiary: Education
- **Size**: ~50M students/educators
- **Need**: Learning 3D concepts, project creation
- **Willingness to Pay**: Low ($5-15/month)

### 7.2 Competitive Landscape

| Competitor | Strengths | Weaknesses | Our Advantage |
|------------|-----------|------------|---------------|
| Blender | Free, powerful | Steep learning curve | Instant results, no training needed |
| SketchUp | Easy to use | Limited AI | AI-powered generation |
| Spline | Modern UI | No sketch input | Natural drawing input |
| Kaedim | AI 3D | Image-only input | Sketch-first workflow |
| Luma AI | Video-to-3D | Requires video | Simple sketch input |

### 7.3 Business Model Options

#### Freemium Model
- **Free Tier**: 10 generations/month, watermarked exports
- **Pro Tier** ($19/month): 100 generations, HD exports, all styles
- **Team Tier** ($49/user/month): Unlimited, collaboration, API access
- **Enterprise**: Custom pricing, dedicated support, SLA

#### Credit-Based Model
- Pay-per-generation
- Bulk credit packages
- Subscription + credits hybrid

#### Marketplace Model
- User-generated asset sales
- Platform takes 20% commission
- Creator monetization

---

## 8. Roadmap

### Q1 2025: Foundation
- [ ] User authentication & accounts
- [ ] Cloud storage for projects
- [ ] Usage analytics implementation
- [ ] Payment integration (Stripe)
- [ ] Text-to-3D basic implementation

### Q2 2025: Growth Features
- [ ] Style transfer system (5 styles)
- [ ] AI scene composer
- [ ] Mobile web support
- [ ] Public gallery/showcase
- [ ] Social sharing features

### Q3 2025: Professional Tools
- [ ] Team collaboration
- [ ] API for developers
- [ ] Advanced animation system
- [ ] Plugin architecture
- [ ] Brand guidelines support

### Q4 2025: Scale & Enterprise
- [ ] Enterprise SSO
- [ ] On-premise deployment option
- [ ] Custom model training
- [ ] Audit logs & compliance
- [ ] SLA-backed support

---

## 9. Success Metrics

### 9.1 User Metrics
| Metric | Target (6 months) | Target (12 months) |
|--------|-------------------|---------------------|
| MAU | 10,000 | 100,000 |
| DAU/MAU Ratio | 20% | 30% |
| Retention (30-day) | 25% | 40% |
| NPS Score | 40 | 50+ |

### 9.2 Business Metrics
| Metric | Target (6 months) | Target (12 months) |
|--------|-------------------|---------------------|
| MRR | $20,000 | $200,000 |
| Conversion Rate | 3% | 5% |
| ARPU | $15 | $25 |
| Churn Rate | <10% | <7% |

### 9.3 Technical Metrics
| Metric | Target |
|--------|--------|
| Generation Success Rate | >95% |
| Average Generation Time | <30s |
| API Uptime | 99.9% |
| Error Rate | <1% |

---

## 10. Risks & Mitigations

### 10.1 Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| AI API costs escalate | High | Medium | Caching, rate limiting, model optimization |
| Quality inconsistency | Medium | Medium | Prompt engineering, user feedback loop |
| Scaling challenges | High | Low | Kubernetes, auto-scaling, CDN |
| API provider changes | High | Low | Multi-provider strategy, abstraction layer |

### 10.2 Business Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Competition from big players | High | Medium | Focus on UX, niche features, community |
| Low conversion rates | High | Medium | Freemium optimization, value demonstration |
| IP/Copyright issues | High | Low | Clear ToS, content moderation, attribution |

### 10.3 Market Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| AI hype cycle downturn | Medium | Medium | Focus on utility over novelty |
| Economic downturn | Medium | Medium | Flexible pricing, SMB focus |
| Regulation changes | Medium | Low | Compliance team, adaptable architecture |

---

## Appendix A: User Personas

### Persona 1: Indie Game Developer "Alex"
- **Age**: 28
- **Role**: Solo indie developer
- **Pain Points**: Can't afford 3D artists, slow asset creation
- **Goals**: Ship game faster, unique art style
- **Usage**: 20+ hours/week, needs batch generation

### Persona 2: Architecture Student "Maya"
- **Age**: 22
- **Role**: Graduate student
- **Pain Points**: Complex software, expensive licenses
- **Goals**: Quick concept visualization, portfolio building
- **Usage**: 5-10 hours/week, quality over quantity

### Persona 3: Content Creator "Jordan"
- **Age**: 35
- **Role**: YouTube/TikTok creator
- **Pain Points**: Need quick visual assets, no 3D skills
- **Goals**: Stand out with 3D content, fast turnaround
- **Usage**: 2-5 hours/week, simple objects

---

## Appendix B: Technical Requirements

### Performance Requirements
- Initial load time: <3 seconds
- Generation time: <45 seconds (95th percentile)
- 3D render at 60fps on mid-range devices
- Support 100+ objects in scene

### Browser Support
- Chrome 90+
- Firefox 90+
- Safari 15+
- Edge 90+

### Device Support
- Desktop: Windows, macOS, Linux
- Tablet: iPad, Android tablets (limited)
- Mobile: View-only initially

### Security Requirements
- HTTPS everywhere
- API key encryption
- Rate limiting per user
- Input sanitization for code execution
- GDPR compliance

---

## Appendix C: Glossary

| Term | Definition |
|------|------------|
| glTF | GL Transmission Format - 3D file format |
| Three.js | JavaScript 3D library |
| R3F | React Three Fiber - React renderer for Three.js |
| TLDraw | Open-source drawing library |
| SSE | Server-Sent Events - streaming protocol |
| PBR | Physically Based Rendering |
| MAU | Monthly Active Users |
| MRR | Monthly Recurring Revenue |
| ARPU | Average Revenue Per User |

---

*Document maintained by Product Team*
*Last updated: December 2024*
