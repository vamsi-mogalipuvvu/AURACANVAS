# AURA Canvas Architect - Voice-First AI Architecture Designer

Transform natural language into professional system diagrams and production-ready code using voice commands and AI.

## Overview

AURA Canvas Architect is a voice-controlled architecture design tool that converts natural language into system diagrams and code. It combines wake word activation, multi-AI processing, and real-time diagram generation to make professional architecture accessible.

## Features

- **Voice-First Control**: "Hey Jarvis" wake word activation with speech synthesis
- **Multi-AI Engine**: GitHub Models (GPT-4o), Azure AI, and Microsoft AI integration
- **Dual Diagram Generation**: System architecture + sequence diagrams simultaneously
- **Component Code Generation**: Production-ready code in TypeScript, Python, SQL
- **Cyberpunk HUD Interface**: Dark theme with real-time animations
- **Session Management**: Persistent project archives with localStorage

## Tech Stack

**Frontend**: React 19, TypeScript, Tailwind CSS, Vite
**Backend**: Express.js with CORS middleware
**AI / APIs**: GitHub Models (GPT-4o), Azure OpenAI, Microsoft AI
**Tools**: Mermaid.js 10+, Web Speech API, TSX runner

## Demo

**Live Demo**: https://drive.google.com/file/d/14caQEIJgfQkYfXaqAiEuhtYoguYbOOk/view?usp=sharing
**Screenshots PDF**: https://drive.google.com/file/d/1e0SJn_7ETOz1Y_ozAP-uTsJZqhmoncfM/view?usp=sharing

## Quick Start

```bash
git clone https://github.com/vamsi-mogalipuvvu/AURACANVAS.git
cd AURACANVAS
npm install
cp .env.example .env
# Add GITHUB_TOKEN to .env file
npm run dev
# Open http://localhost:3000
```

## Use Cases

- **Enterprise Architecture**: Design scalable microservices and distributed systems
- **Startup Prototyping**: Quickly visualize and iterate on system designs
- **Team Collaboration**: Share diagrams and code with development teams
- **Educational Tools**: Teach software architecture concepts visually
- **Documentation**: Generate professional architecture diagrams for technical docs

## Architecture (Brief)

- **Voice Processing Layer**: Web Speech API with wake word detection and command parsing
- **Multi-AI Orchestration**: Intelligent routing between GitHub, Azure, and Microsoft AI
- **Diagram Rendering Engine**: Mermaid.js integration with interactive controls
- **Code Generation Pipeline**: Context-aware component code generation
- **Session Management**: LocalStorage-based persistence with project organization

## Project Structure

```
AURACANVAS/
components/
  MermaidDiagram.tsx      # Interactive diagram renderer
  Sidebar.tsx             # Session management UI
  TypewriterText.tsx      # Animated text display
services/
  githubService.ts        # GitHub Models API client
  azureService.ts         # Azure AI integration
  microsoftService.ts     # Microsoft AI client
App.tsx                   # Main application
server.ts                 # Express server
types.ts                  # TypeScript definitions
```

## Future Work

- **Multi-language Voice Support**: Expand beyond English wake word detection
- **Cloud Deployment**: Enterprise SaaS version with team collaboration
- **Advanced AI Models**: Integration with latest architecture-specific AI models
- **Export Formats**: Additional diagram export options (PNG, PDF, Draw.io)
- **Plugin System**: Extensible architecture for custom components

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.
