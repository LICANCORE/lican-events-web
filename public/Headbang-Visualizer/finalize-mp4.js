/* Remux only: encoded H.264/AAC samples never leave this browser. */
async function finalizeMp4(blob) {
  const input = await blob.arrayBuffer();
  const file = MP4Box.createFile();
  let parseError;
  file.onError = (error) => { parseError = error; };
  input.fileStart = 0;
  file.appendBuffer(input);
  file.flush();
  if (parseError) throw new Error(`MP4 ilegible: ${parseError}`);
  const info = file.getInfo();
  const video = info.tracks.find((track) => track.video);
  const audioTrack = info.tracks.find((track) => track.audio);
  if (!video?.codec.startsWith('avc1') || audioTrack?.codec !== 'mp4a.40.2') {
    throw new Error('La captura debe contener vídeo H.264 y audio AAC');
  }
  const videoEntry = file.getTrackById(video.id).mdia.minf.stbl.stsd.entries[0];
  const audioEntry = file.getTrackById(audioTrack.id).mdia.minf.stbl.stsd.entries[0];
  const configStream = new DataStream(undefined, 0, DataStream.BIG_ENDIAN);
  videoEntry.avcC.write(configStream);
  const findAudioConfig = (descriptor) => {
    if (descriptor.tag === 5) return descriptor.data;
    for (const child of descriptor.descs || []) {
      const found = findAudioConfig(child);
      if (found) return found;
    }
  };
  const audioConfig = findAudioConfig(audioEntry.esds.esd);
  if (!audioConfig) throw new Error('No se encontró la configuración AAC');
  const target = new Mp4Muxer.ArrayBufferTarget();
  const muxer = new Mp4Muxer.Muxer({
    target,
    video: { codec: 'avc', width: video.video.width, height: video.video.height },
    audio: { codec: 'aac', sampleRate: audioTrack.audio.sample_rate, numberOfChannels: audioTrack.audio.channel_count },
    fastStart: 'in-memory',
    firstTimestampBehavior: 'cross-track-offset',
  });
  let videoCount = 0;
  let audioCount = 0;
  // Decode order and composition offsets preserve B frames and the common A/V clock.
  const samples = [video, audioTrack].flatMap((track) =>
    file.getTrackById(track.id).samples.map((sample, index) => ({ track, sample, index }))
  ).sort((a, b) => a.sample.dts / a.track.timescale - b.sample.dts / b.track.timescale);
  for (const { track, sample, index } of samples) {
    const data = file.getSample(file.getTrackById(track.id), index).data;
    const timestamp = sample.cts * 1e6 / track.timescale;
    const duration = sample.duration * 1e6 / track.timescale;
    if (track === video) {
      muxer.addVideoChunkRaw(data, sample.is_sync ? 'key' : 'delta', timestamp, duration,
        videoCount++ === 0 ? { decoderConfig: { codec: video.codec, description: configStream.buffer.slice(8) } } : undefined,
        (sample.cts - sample.dts) * 1e6 / track.timescale);
    } else {
      muxer.addAudioChunkRaw(data, 'key', timestamp, duration,
        audioCount++ === 0 ? { decoderConfig: { codec: audioTrack.codec, description: audioConfig } } : undefined);
    }
    file.releaseUsedSamples(track.id, index + 1);
  }
  if (!videoCount || !audioCount) throw new Error('Captura vacía o sin audio');
  muxer.finalize();
  return new Blob([target.buffer], { type: 'video/mp4' });
}
