# Safety Alert Components

A comprehensive set of React components for displaying FDA safety alerts, recalls, and warnings for medications.

## Components

### AlertSearchInput
Search input component for querying drug alerts.

```tsx
<AlertSearchInput 
  onSearch={(drugName) => fetchAlerts(drugName)} 
  isLoading={false}
/>
```

### AlertCard
Displays individual FDA alert with expandable details.

```tsx
<AlertCard 
  alert={alert} 
  defaultExpanded={false}
/>
```

**Alert Structure:**
- `id`: Unique recall number
- `severity`: "recall" | "warning" | "info"
- `title`: Product description
- `description`: Reason for alert
- `date`: ISO date string
- `lot_numbers`: Array of affected lot numbers

### AlertList
Renders a list of alerts with empty state handling.

```tsx
<AlertList 
  alerts={alerts}
  emptyMessage="No alerts found"
/>
```

### AlertSummary
Summary cards showing alert counts by severity.

```tsx
<AlertSummary 
  alerts={alerts}
  drugName="Aspirin"
/>
```

### AlertFilters
Filter alerts by severity level.

```tsx
<AlertFilters
  selectedSeverity={selectedSeverity}
  onSeverityChange={setSeverity}
  counts={{ recall: 2, warning: 5, info: 3 }}
/>
```

### AlertTimeline
Chronological timeline view of alerts.

```tsx
<AlertTimeline alerts={alerts} />
```

### AlertStats
Statistical overview with trend analysis.

```tsx
<AlertStats alerts={alerts} />
```

### AlertExport
Export alerts in multiple formats (JSON, CSV, Text).

```tsx
<AlertExport
  alerts={alerts}
  drugName="Aspirin"
  disabled={false}
/>
```

## Usage Example

```tsx
import {
  AlertSearchInput,
  AlertList,
  AlertSummary,
  AlertFilters,
  AlertTimeline,
  AlertExport,
  AlertStats,
} from "@/components/SafetyAlert";

function SafetyAlertPage() {
  const [alerts, setAlerts] = useState([]);
  const [severity, setSeverity] = useState("all");

  return (
    <div>
      <AlertSearchInput onSearch={fetchAlerts} />
      <AlertSummary alerts={alerts} />
      <AlertFilters 
        selectedSeverity={severity}
        onSeverityChange={setSeverity}
      />
      <AlertList alerts={filteredAlerts} />
      <AlertTimeline alerts={alerts} />
      <AlertStats alerts={alerts} />
      <AlertExport alerts={alerts} drugName="Aspirin" />
    </div>
  );
}
```

## API Integration

The components work with the backend FDA alerts API:

```typescript
import { getFDAAlerts } from "@/lib/api";

const response = await getFDAAlerts("Aspirin");
// Returns: { drug_name: string, alerts: FDAAlert[] }
```

## Severity Levels

- **Recall** (Red): Product recalls, serious safety issues
- **Warning** (Yellow): Safety warnings, adverse events
- **Info** (Blue): Informational updates

## Features

- Real-time FDA alert checking
- Severity-based filtering
- Timeline visualization
- Trend analysis
- Multi-format export (JSON, CSV, Text)
- Lot number tracking
- Responsive design
- Empty state handling
- Loading states
