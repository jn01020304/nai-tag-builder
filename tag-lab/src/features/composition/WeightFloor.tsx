import type { CSSProperties } from "react";
import { roundWeight, type FlattenedArtist } from "../../domain/composition";

interface WeightFloorProps {
  artists: FlattenedArtist[];
}

export function WeightFloor({ artists }: WeightFloorProps) {
  const maxWeight = Math.max(1, ...artists.map((artist) => Math.abs(artist.weight)));

  return (
    <section className="weight-floor">
      <header className="floor-header">
        <div>
          <h2>Artist weight projection</h2>
          <span>중복 경로는 합산된 최종값으로 표시</span>
        </div>
        <span>{artists.length} axes</span>
      </header>
      <div className="weight-chart">
        {artists.map((artist, index) => {
          const magnitude = Math.max(2, (Math.abs(artist.weight) / maxWeight) * 46);
          const style = {
            "--bar-height": `${magnitude}%`,
            "--artist-color": `hsl(${(index * 137.508) % 360} 65% 62%)`,
          } as CSSProperties;
          return (
            <div className="weight-axis" key={artist.tag} style={style}>
              <div className="weight-track">
                <div className={`weight-bar ${artist.weight < 0 ? "negative" : "positive"}`} />
                <span className="weight-value">{roundWeight(artist.weight).toFixed(2)}</span>
              </div>
              <span className="weight-name">{artist.tag}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
