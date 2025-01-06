import torch
import torch.optim as optim
from memgpt_model import MemGPT
from data_loader import get_data_loader


def train(model, data_loader, optimizer, criterion, device):
    model.train()
    total_loss = 0.0
    for input_text, target_text in data_loader:
        input_text, target_text = input_text.to(device), target_text.to(device)

        optimizer.zero_grad()
        output = model(input_text)
        loss = criterion(output.transpose(1, 2), target_text)
        loss.backward()
        optimizer.step()

        total_loss += loss.item()
    return total_loss / len(data_loader)


def main():
    # Hyperparameters
    vocab_size = 10000
    embed_dim = 256
    num_heads = 8
    num_layers = 4
    max_len = 100
    batch_size = 32
    epochs = 10
    learning_rate = 0.001

    # Sample text and vocabulary
    text = "This is a sample text for the MemGPT project. Feel free to replace this with your own dataset."
    vocab = {char: idx for idx, char in enumerate(set(text))}

    # Model, optimizer, and criterion
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = MemGPT(vocab_size, embed_dim, num_heads, num_layers, max_len).to(device)
    optimizer = optim.Adam(model.parameters(), lr=learning_rate)
    criterion = torch.nn.CrossEntropyLoss()

    # Data loader
    data_loader = get_data_loader(text, vocab, max_len, batch_size)

    # Training loop
    for epoch in range(epochs):
        loss = train(model, data_loader, optimizer, criterion, device)
        print(f'Epoch {epoch + 1}/{epochs}, Loss: {loss:.4f}')


if __name__ == "__main__":
    main()
