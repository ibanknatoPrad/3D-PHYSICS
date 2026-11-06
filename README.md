# Electromagnetism Suite ⚡

 <img width="906" height="425" alt="image" src="https://github.com/user-attachments/assets/f6eb2d40-3ce3-4c10-9a3c-0dc95baa4046" />


  <img width="906" height="425" alt="image" src="https://ibanknatoprad.github.io/3D-PHYSICS/biot-savart-d3e.gif" />



An interactive, high-performance 3D physics educational platform built with **Three.js** and Vanilla JavaScript/WebGL, styled with a calm, cool luxury dark frosted glass aesthetic.

## Features

- **Biot–Savart Law (Continuous Flowing Particle System)**: Real-time particle stream circulating along concentric magnetic field shell lines around a current-carrying wire. Adjust current intensity, density, and shell count.
- **Fleming's Rules (Auto-Aligning Vector Hand)**: 3D vector hand model with orthogonal force (Thumb), field (Index), and current (Middle) vector fingers. Drag or rotate magnetic poles with smooth quaternion slerp auto-alignment.
- **Lorentz Force (Continuous Particle Stream & 3D Helix Emitter)**: Continuous particle stream emitted into a vacuum chamber with real-time Runge-Kutta numerical integration of $\mathbf{F} = q(\mathbf{E} + \mathbf{v} \times \mathbf{B})$. Sliders for field magnitude, velocity, and dual-axis 3D B-field rotation (Pitch $\theta$ & Yaw $\phi$) with Proton/Electron toggle.
- **Faraday’s Law (3D Hologram Graph & Induction)**: Physically drag a permanent bar magnet through a copper induction coil. Real-time floating 3D line graph plots instantaneous induced EMF $\varepsilon = -N \frac{d\Phi}{dt}$ matching mouse velocity, accompanied by a reactive glowing galvanometer bulb.
- **Global Blueprint Mode (⬡)**: Instantly convert all solid materials across all simulations into technical cyan wireframes.
- **Global Raycasting**: Hovering over interactive 3D components provides real-time scaling feedback and contextual HUD tags.
- **Liquid Glass Background**: Custom 2D WebGL fragment shader running Fractal Brownian Motion (FBM) with organic caustics and refractions.

## Tech Stack

- **Frontend**: Plain HTML5, CSS3 (Glassmorphism), Vanilla JavaScript
- **3D Engine**: Three.js (r128) + OrbitControls via CDN
- **Backend**: Minimal Node.js / Express static server (`server.js`)

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) (v18+)

### Installation & Run

1. Clone the repository:
   ```bash
   git clone https://github.com/ammar-0911/3D-PHYSICS.git
   cd 3D-PHYSICS
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   ```

4. Open your browser at [http://localhost:3000](http://localhost:3000).

*(Alternatively, run `start.bat` on Windows or `python serve.py`)*
