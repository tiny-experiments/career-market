import { useLocation } from "react-router";

/** Prints the current URL so a test can see where a click went. */
export function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location">{`${location.pathname}${location.search}`}</output>
  );
}
