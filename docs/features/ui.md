# User Interface Mechanics

### Architecture
- React 18, Vite, Tailwind CSS.
- Hand-tailored UI grid partitioned by simple layout boundaries.

### State Persistence
The `zustand` persistent layer (`src/store/index.ts`) acts as our localized cache for retaining specific table structures and UI bounds even if the browser closes.
