import { openai } from '@ai-sdk/openai';
import { env } from './config/env';
import { AudioRecorder } from './voice-interface/capture-audio-from-mic';
import { detectSilence } from './voice-interface/detect-silence';
import { RealtimeConversation } from './voice-interface/openai-realtime-2';
import { AudioPlayer } from './voice-interface/play-readablestream-audio';

async function main() {
  // Configurações
  const silenceThreshold = 0.02;
  const silenceTimeThreshold = 300; // 1 segundo de silêncio para commit
  let isPlaying = false;
  let lastSilenceTime: number | null = null;
  let currentAudioPlayer: AudioPlayer | null = null;

  // Instanciar o RealtimeConversation
  const realtimeConversation = new RealtimeConversation(
    { listeningModel: { apiKey: env.OPENAI_API_KEY }, speechModel: { apiKey: env.OPENAI_API_KEY }, speaker: "alloy" },
    {
      name: "Conversation Assistant",
      instructions: "Você é um assistente útil e conversacional. Mantenha as respostas breves e naturais.",
      model: openai("gpt-4o-mini")
    },
    { filetype: "wav" },
    { speaker: "nova", speed: 1.0 }
  );

  console.log('Inicializando captura de áudio do microfone...');

  // Instanciar o captador de áudio
  const audioCapture = new AudioRecorder({
    onCapture: (data) => {
      // Processar cada chunk de áudio capturado
      handleAudioChunk(data.buffer);
    },
    chunkLengthSeconds: 2,
    overlapSeconds: 0.5
  });

  audioCapture.init();

  console.log('Captura de áudio inicializada. Fale algo...');

  // Função para parar a reprodução de áudio atual
  const stopAudio = () => {
    if (currentAudioPlayer) {
      currentAudioPlayer.cancel();
      currentAudioPlayer = null;
    }
  };

  // Função para processar os chunks de áudio
  async function handleAudioChunk(audioChunk: Buffer) {
    // Uso correto da função detectSilence com um número
    const { isSilent } = detectSilence(audioChunk, { threshold: silenceThreshold });

    // Caso 1: Se estiver reproduzindo uma resposta
    if (isPlaying) {
      // Se o usuário começou a falar, interrompe a reprodução
      if (!isSilent) {
        console.log('Usuário começou a falar. Interrompendo reprodução...');
        stopAudio();
        isPlaying = false;
      }
      // Importante: SEMPRE ignoramos o áudio capturado durante a reprodução
      // para evitar que o assistente processe seu próprio áudio
      return;
    }

    // Caso 2: Processamento de áudio em silêncio
    if (isSilent) {
      // Inicia a contagem de tempo de silêncio se ainda não iniciou
      if (!lastSilenceTime) {
        lastSilenceTime = Date.now();
        return;
      }

      const silenceDuration = Date.now() - lastSilenceTime;
      const isSilenceLongEnough = silenceDuration >= silenceTimeThreshold;

      // Commit e resposta apenas quando o silêncio for suficientemente longo
      if (isSilenceLongEnough) {
        await processAndRespondToMessage(audioChunk);
        lastSilenceTime = null;
      }
      return;
    }

    // Caso 3: Usuário está falando (não é silêncio)
    lastSilenceTime = null;

    // Adicionar o áudio ao stream do RealtimeConversation
    try {
      realtimeConversation.processAudioInput(audioChunk);
    } catch (error) {
      console.error('Erro ao enviar áudio para processamento:', error);
    }
  }

  // Função auxiliar para processar a mensagem e reproduzir a resposta
  async function processAndRespondToMessage(audioChunk: Buffer) {
    console.log('Silêncio detectado. Processando mensagem...');

    try {
      // Definir isPlaying para true ANTES de processar o áudio
      // isso garante que quaisquer novos sons durante o processamento serão ignorados
      isPlaying = true;

      // Commit e obtenha a resposta do modelo
      realtimeConversation.processAudioInput(audioChunk);
      const response = await realtimeConversation.commitAudioBuffer();
      console.log('Resposta do assistente:', response.text);

      // Reproduza o áudio
      console.log('Reproduzindo resposta...');

      if (response.audio) {
        currentAudioPlayer = new AudioPlayer(response.audio);
        await currentAudioPlayer.play();
        currentAudioPlayer = null;
      }

      isPlaying = false;
      console.log('Reprodução concluída. Aguardando próximo comando...');
    } catch (error) {
      console.error('Erro ao processar resposta:', error);
      // Em caso de erro, garantir que o estado volta para escuta
      isPlaying = false;
    }
  }

  // Gerenciar encerramento da aplicação
  process.on('SIGINT', async () => {
    console.log('Encerrando aplicação...');
    stopAudio();
    audioCapture.stop();
    realtimeConversation.close();
    process.exit(0);
  });

  // Manter o processo rodando
  await new Promise(() => { });
}

// Iniciar a aplicação
main().catch(error => {
  console.error('Erro na aplicação:', error);
  process.exit(1);
}); 