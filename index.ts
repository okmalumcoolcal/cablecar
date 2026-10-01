import { scanMediaRoot } from "./src/modules/scanner";

/* Running real-world test against designated CableCar media root */
const channels = scanMediaRoot("\\\\Mac\\Home\\Downloads\\CALN_RECWRK\\24_TransferToRecDrive\\0_CNAIRCN_Downloads\\CableCar");

console.log(`Found ${channels.length} channel(s):\n`);

for (const channel of channels)
{
  console.log(`Channel: ${channel.name} (id: ${channel.id})`);
  console.log(`Files: ${channel.files.length}`);

  for (const file of channel.files)
  {
    console.log(`  - ${file.name}`);
  }

  console.log("");
}
// console.log("Hello via Bun!");