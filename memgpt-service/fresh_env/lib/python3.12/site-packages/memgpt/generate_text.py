import torch
from memgpt_model import MemGPT


def generate_text(model, start_text, vocab, max_len, device):
    model.eval()
    text = start_text
    input_text = torch.tensor([vocab[char] for char in text], dtype=torch.long).unsqueeze(0).to(device)

    with torch.no_grad():
        for _ in range(max_len):
            output = model(input_text)
            next_char_idx = output[:, -1, :].argmax(dim=1).item()
            next_char = {v: k for k, v in vocab.items()}[next_char_idx]
            text += next_char
            input_text = torch.cat([input_text, torch.tensor([[next_char_idx]], dtype=torch.long).to(device)], dim=1)

    return text


def main():
    # Hyperparameters
    vocab_size = 10000
    embed_dim = 256
    num_heads = 8
    num_layers = 4
    max_len = 100

    # Sample text and vocabulary
    text = "This is a sample text for the MemGPT project. Feel free to replace this with your own dataset."
    vocab = {char: idx for idx, char in enumerate(set(text))}

    # Load the trained model
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = MemGPT(vocab_size, embed_dim, num_heads, num_layers, max_len).to(device)
    # Load your model weights here (if you have a saved model)
    # model.load_state_dict(torch.load('path_to_your_saved_model.pth'))

    # Generate text
    start_text = "This is a"
    generated_text = generate_text(model, start_text, vocab, 50, device)
    print("Generated Text:", generated_text)


if __name__ == "__main__":
    main()
