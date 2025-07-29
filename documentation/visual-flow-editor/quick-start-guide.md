# Visual Flow Editor - Quick Start Guide

## 🚀 **What is the Visual Flow Editor?**

The Visual Flow Editor transforms complex Python script execution into an intuitive, drag-and-drop visual experience. Instead of running scripts from the command line with multiple input prompts, users can:

- **Drag blocks** onto a canvas to represent script parameters
- **Connect blocks** to show data flow
- **Configure parameters** through user-friendly forms
- **Execute remotely** via MCP or SSH
- **Monitor progress** in real-time

## 🎯 **Current Focus: FlowDir Script**

We're starting with the `flowdir.py` script, which creates complex directory structures for VLSI/EDA workflows. This script currently requires:

```bash
# Current CLI experience:
python3 flowdir.py
> Enter the name of your project: my_project
> Enter the name of your block: my_block  
> Enter the tool to be used (cadence, synopsys): cadence
> Enter the stage in flow (ex: all Synthesis PD LEC STA): PD
> Enter stages Floorplan Place CTS Route all: all
> Enter run name: run_001
> Enter ref run path (to skip press enter): 
```

## 🎨 **Visual Transformation**

### **Before (CLI)**
```
Terminal → Script Prompts → Manual Input → Directory Creation
```

### **After (Visual Editor)**
```
Canvas → Drag Blocks → Configure → Connect → Execute → Monitor
```

### **Visual Block Flow**
```
[Project Config] → [Tool Selection] → [Flow Stage] → [PD Steps] → [Run Config] → [Execute]
     ↓                    ↓               ↓            ↓           ↓           ↓
  my_project          cadence            PD         all steps    run_001    MCP Server
  my_block                                                                     ↓
  username                                                              Directory Structure
```

## 📁 **Documentation Structure**

### **📋 Core Documents**

1. **[README.md](./README.md)** - Complete project overview and architecture
2. **[flowdir-analysis.md](./flowdir-analysis.md)** - Detailed script analysis and visual mapping
3. **[implementation-roadmap.md](./implementation-roadmap.md)** - 12-week development plan
4. **[mcp-integration-plan.md](./mcp-integration-plan.md)** - MCP execution strategy
5. **[development-tracker.md](./development-tracker.md)** - Progress tracking and metrics

### **🔍 Key Sections to Review**

#### **For Product Understanding**
- README.md → Core Concept & User Experience Flow
- flowdir-analysis.md → Visual Block Design

#### **For Technical Implementation**  
- README.md → Technical Architecture & Database Schema
- mcp-integration-plan.md → Execution Engine Details

#### **For Project Management**
- implementation-roadmap.md → Timeline & Milestones
- development-tracker.md → Current Status & Next Steps

## 🏗️ **Architecture Overview**

### **Frontend Stack**
```
React + TypeScript
├── React Flow (Canvas & Nodes)
├── Zustand (State Management)  
├── React Hook Form (Configuration)
└── Tailwind CSS (Styling)
```

### **Backend Stack**
```
Node.js + Express
├── PostgreSQL (User Workflows)
├── WebSocket (Real-time Updates)
├── MCP Integration (Script Execution)
└── UUID User Binding (Isolation)
```

### **Database Tables**
```sql
user_workflows          -- Canvas layouts & configurations
workflow_executions     -- Execution history & logs  
script_templates        -- Available script types
```

## 🔌 **MCP Integration Strategy**

### **How It Works**
1. **User designs workflow** on visual canvas
2. **Parameters extracted** from block configurations  
3. **MCP server selected** from user's configured servers
4. **Script executed remotely** with real-time log streaming
5. **Results displayed** in the UI with execution history

### **Execution Flow**
```
Visual Canvas → Parameter Extraction → MCP Server → Python Script → Directory Creation
      ↓                    ↓                ↓            ↓              ↓
   Block Config      JSON Parameters    Remote Exec    flowdir.py    File System
```

## 📅 **Development Timeline**

### **Phase 1-2: Foundation (Weeks 1-4)**
- Database schema & API endpoints
- React Flow canvas setup
- Basic block components
- User authentication integration

### **Phase 3-4: Core Features (Weeks 5-8)**  
- FlowDir script integration
- MCP execution engine
- Real-time monitoring
- Parameter validation

### **Phase 5-6: Polish & Launch (Weeks 9-12)**
- UI/UX enhancements
- Testing & optimization
- Documentation & training
- Production deployment

## 🎯 **Success Metrics**

- **User Adoption**: >50% of users try the feature
- **Workflow Creation**: <5 minutes to create first workflow
- **Execution Success**: >95% successful script executions
- **Performance**: <2s canvas load time

## 🚀 **Getting Started (Development)**

### **1. Review Documentation**
```bash
# Read core documents in order:
1. README.md - Overall understanding
2. flowdir-analysis.md - Technical details
3. implementation-roadmap.md - Development plan
```

### **2. Set Up Development Environment**
```bash
# Create feature branch
git checkout -b feature/visual-flow-editor

# Install dependencies (when ready)
npm install reactflow zustand react-hook-form
```

### **3. Start with Foundation**
```bash
# Week 1 priorities:
1. Database migrations
2. Basic API structure  
3. React Flow setup
4. Sidebar integration
```

## 🔗 **Key Resources**

### **External Libraries**
- **[React Flow](https://reactflow.dev/)** - Node-based editor library
- **[Zustand](https://github.com/pmndrs/zustand)** - State management
- **[React Hook Form](https://react-hook-form.com/)** - Form handling

### **Internal Systems**
- **MCP Service** - `src/services/mcpService.js`
- **User Authentication** - `src/routes/auth.js`
- **Database Layer** - `src/database.js`
- **WebSocket** - `src/websocket/`

## 🤝 **Team Coordination**

### **Roles & Responsibilities**
- **Frontend Development** - React Flow canvas, block components, UI/UX
- **Backend Development** - API endpoints, MCP integration, WebSocket
- **Database Design** - Schema implementation, migrations, optimization
- **Testing & QA** - Unit tests, integration tests, user acceptance testing

### **Communication**
- **Daily Standups** during active development
- **Weekly Reviews** of progress against roadmap
- **Milestone Demos** at end of each phase
- **Documentation Updates** as features are completed

## 📞 **Next Steps**

1. **Review all documentation** to understand the complete scope
2. **Set up development branch** for the feature
3. **Begin Phase 1 implementation** following the roadmap
4. **Regular progress updates** using the development tracker

---

This Visual Flow Editor will revolutionize how users interact with complex Python scripts, making technical workflows accessible through intuitive visual interfaces while leveraging your existing MCP infrastructure for powerful remote execution capabilities.
