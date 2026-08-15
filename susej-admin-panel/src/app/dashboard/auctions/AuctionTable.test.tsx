import { render } from "@testing-library/react";
import AuctionTable from "./AuctionTable";

test("renders AuctionTable component", () => {
  const { container } = render(<AuctionTable />);
  const heading = container.querySelector("h1");
  expect(heading).toBeInTheDocument();
});